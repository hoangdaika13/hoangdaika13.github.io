param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLocal = Join-Path $taskRoot '.study-local'
$taskBin = Join-Path $taskLocal 'livekit-1.13.8'
$taskExe = Join-Path $taskBin 'livekit-server.exe'
$taskState = Join-Path $taskLocal 'server-state.json'
if ($Stop) {
  if (Test-Path -LiteralPath $taskState) {
    $record = Get-Content -LiteralPath $taskState -Raw | ConvertFrom-Json
    $process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($process -and $process.Path -eq $taskExe) { Stop-Process -Id $process.Id; Write-Output 'Stopped this local LiveKit instance.' }
  }
  return
}
New-Item -ItemType Directory -Path $taskLocal -Force | Out-Null
if (!(Test-Path -LiteralPath $taskExe)) {
  $taskZip = Join-Path $taskLocal 'livekit-1.13.8.zip'
  Invoke-WebRequest -Uri 'https://github.com/livekit/livekit/releases/download/v1.13.8/livekit_1.13.8_windows_amd64.zip' -OutFile $taskZip
  $checksum = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($checksum -ne '1c9bc93adf19528a86865dbdce5fb3958e7310c43ff8b437287aeb72669f26bd') { throw 'LiveKit archive checksum mismatch. Nothing was executed.' }
  Expand-Archive -LiteralPath $taskZip -DestinationPath $taskBin -Force
}
if (Test-Path -LiteralPath $taskState) {
  $record = Get-Content -LiteralPath $taskState -Raw | ConvertFrom-Json
  $process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
  if ($process -and $process.Path -eq $taskExe) { Write-Output 'Local LiveKit is already running at ws://127.0.0.1:7880'; return }
}
function New-LocalSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  return ([System.BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
}
$taskCredentials = Join-Path $taskLocal 'credentials.json'
if (!(Test-Path -LiteralPath $taskCredentials)) {
  @{ LIVEKIT_URL='ws://127.0.0.1:7880'; LIVEKIT_API_KEY=('hhlocal'+(New-LocalSecret).Substring(0,16)); LIVEKIT_API_SECRET=(New-LocalSecret) } | ConvertTo-Json | Set-Content -LiteralPath $taskCredentials -Encoding utf8
}
$credentials = Get-Content -LiteralPath $taskCredentials -Raw | ConvertFrom-Json
$taskConfig = Join-Path $taskLocal 'livekit.yaml'
$content = @"
port: 7880
bind_addresses:
  - 127.0.0.1
rtc:
  node_ip: 127.0.0.1
  use_external_ip: false
  tcp_port: 7881
  udp_port: 7882
keys:
  $($credentials.LIVEKIT_API_KEY): $($credentials.LIVEKIT_API_SECRET)
"@
$content | Set-Content -LiteralPath $taskConfig -Encoding utf8
$process = Start-Process -FilePath $taskExe -ArgumentList @('--config', ('"'+$taskConfig+'"')) -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLocal 'livekit.stdout.log') -RedirectStandardError (Join-Path $taskLocal 'livekit.stderr.log') -PassThru
for ($attempt = 0; $attempt -lt 15; $attempt++) {
  Start-Sleep -Milliseconds 200
  $process.Refresh()
  if ($process.HasExited) { throw 'Local LiveKit did not start. Check the private log file for port/configuration errors.' }
  try {
    $health = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:7880' -TimeoutSec 1
    if ($health.StatusCode -eq 200) { break }
  } catch { }
}
if (!$health -or $health.StatusCode -ne 200) {
  Stop-Process -Id $process.Id
  throw 'Local LiveKit health check failed. No credentials were printed.'
}
@{pid=$process.Id; binary=$taskExe; endpoint='ws://127.0.0.1:7880'} | ConvertTo-Json | Set-Content -LiteralPath $taskState -Encoding utf8
Write-Output 'Started local LiveKit at ws://127.0.0.1:7880. Credentials are private and excluded from Git.'
