param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\assets\fortune\tarot\rws")
)

$ErrorActionPreference = "Stop"
$category = "Category:Rider-Waite-Smith tarot deck (Geldard)"
$api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtitle=$([uri]::EscapeDataString($category))&gcmtype=file&gcmlimit=100&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=360&origin=*"
$major = @{
  "The Fool" = "major-fool"; "The Magician" = "major-magician"; "The High Priestess" = "major-high-priestess"; "The Empress" = "major-empress";
  "The Emperor" = "major-emperor"; "The Hierophant" = "major-hierophant"; "The Lovers" = "major-lovers"; "The Chariot" = "major-chariot";
  "Strength" = "major-strength"; "The Hermit" = "major-hermit"; "Wheel of Fortune" = "major-wheel-of-fortune"; "Justice" = "major-justice";
  "The Hanged Man" = "major-hanged-man"; "Death" = "major-death"; "Temperance" = "major-temperance"; "The Devil" = "major-devil";
  "The Tower" = "major-tower"; "The Star" = "major-star"; "The Moon" = "major-moon"; "The Sun" = "major-sun";
  "Judgement" = "major-judgement"; "The World" = "major-world"
}
$ranks = @{ Ace = "ace"; One = "ace"; Two = "two"; Three = "three"; Four = "four"; Five = "five"; Six = "six"; Seven = "seven"; Eight = "eight"; Nine = "nine"; Ten = "ten"; Page = "page"; Knight = "knight"; Queen = "queen"; King = "king" }

$ffmpeg = (Get-Command ffmpeg -ErrorAction Stop).Source
$temporary = Join-Path ([System.IO.Path]::GetTempPath()) ("hh-rws-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $temporary | Out-Null
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

try {
  $response = Invoke-RestMethod -Uri $api -Method Get
  $pages = @($response.query.pages.PSObject.Properties.Value)
  if ($pages.Count -ne 78) { throw "Expected 78 Commons files, received $($pages.Count)." }
  $missingTitles = @($pages | Where-Object { -not $_.imageinfo } | ForEach-Object title)
  if ($missingTitles.Count) {
    $detailApi = "https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=$([uri]::EscapeDataString(($missingTitles -join '|')))&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=360&origin=*"
    $detailResponse = Invoke-RestMethod -Uri $detailApi -Method Get -Headers @{ "User-Agent" = "HHPlatformRightsSync/1.0 (nhhoang130803@gmail.com)" }
    $detailLookup = @{}; @($detailResponse.query.pages.PSObject.Properties.Value) | ForEach-Object { $detailLookup[$_.title] = $_.imageinfo }
    $pages | Where-Object { -not $_.imageinfo } | ForEach-Object { $_ | Add-Member -NotePropertyName imageinfo -NotePropertyValue $detailLookup[$_.title] -Force }
  }
  $assets = @()
  foreach ($page in $pages) {
    $info = $page.imageinfo[0]
    $license = [string]$info.extmetadata.LicenseShortName.value
    $copyrighted = [string]$info.extmetadata.Copyrighted.value
    if ($license -ne "Public domain" -or $copyrighted -ne "False") { throw "Rejected non-PD file: $($page.title) [$license/$copyrighted]" }
    $englishName = $page.title -replace '^File:', '' -replace ' \(Rider-Waite Smith tarot deck\)\.png$', ''
    $slug = $major[$englishName]
    if (-not $slug -and $englishName -match '^(Ace|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Page|Knight|Queen|King) of (Cups|Pentacles|Swords|Wands)$') {
      $slug = $Matches[2].ToLowerInvariant() + "-" + $ranks[$Matches[1]]
    }
    if (-not $slug) { throw "No canonical slug for $englishName." }
    $targetWebp = Join-Path $resolvedOutput ($slug + ".webp")
    if (-not (Test-Path -LiteralPath $targetWebp)) {
      $sourcePng = Join-Path $temporary ($slug + ".png")
      $downloaded = $false
      foreach ($attempt in 1..5) {
        try {
          Invoke-WebRequest -Uri ([string]$info.thumburl) -OutFile $sourcePng -Headers @{ "User-Agent" = "HHPlatformRightsSync/1.0 (nhhoang130803@gmail.com)" }
          $downloaded = $true; break
        }
        catch {
          if ($attempt -eq 5) { throw }
          Start-Sleep -Seconds ([math]::Pow(2, $attempt))
        }
      }
      if (-not $downloaded) { throw "Download failed for $englishName." }
      & $ffmpeg -hide_banner -loglevel error -y -i $sourcePng -c:v libwebp -quality 80 -compression_level 6 $targetWebp
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $targetWebp)) { throw "ffmpeg failed for $englishName." }
      Start-Sleep -Milliseconds 350
    }
    $assets += [ordered]@{
      id = $slug; name = $englishName; file = "assets/fortune/tarot/rws/$slug.webp";
      sourcePage = [string]$info.descriptionurl; sourceFile = [string]$info.url;
      artist = "Pamela Colman Smith"; publicationYear = 1909; license = "Public Domain Mark 1.0";
      licenseUrl = "https://creativecommons.org/publicdomain/mark/1.0/"; attributionRequired = $false;
      transformed = "Wikimedia Commons thumbnail converted to WebP quality 80 without creative recoloring";
      sha256 = (Get-FileHash -LiteralPath $targetWebp -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  }
  $assets = @($assets | Sort-Object id)
  if (($assets.id | Sort-Object -Unique).Count -ne 78) { throw "Canonical output does not contain 78 unique cards." }
  $manifest = [ordered]@{
    schema = "hh.rights-manifest.v1"; collection = "Rider-Waite-Smith Tarot (1909)"; count = 78;
    category = "https://commons.wikimedia.org/wiki/Category:Rider-Waite-Smith_tarot_deck_(Geldard)";
    artist = "Pamela Colman Smith (1878-1951)"; originalPublication = "Rider & Company, 1909";
    rightsStatus = "Public domain in countries with copyright term life + 70 years or shorter; each source file was API-verified as Public domain and Copyrighted=False at sync time.";
    warning = "Do not replace with modern recolored or commercial editions. Recheck territorial status before distribution in countries with longer terms.";
    reviewedAt = (Get-Date).ToUniversalTime().ToString("o"); assets = $assets
  }
  [System.IO.File]::WriteAllText((Join-Path $resolvedOutput "rights-manifest.json"), ($manifest | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
  Write-Output "Synced $($assets.Count) verified public-domain cards to $resolvedOutput"
}
finally {
  if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
