"""Original procedural Astra H-08 anime head and facial landmarks.

The authoritative character sheet uses a slim adult-anime face rather than a
generic round doll head.  Everything in this module is generated from explicit
coordinates and ``mesh.from_pydata`` through :class:`SurfaceBuilder`; no external
mesh, sculpt data, or Blender primitive is imported.
"""

from __future__ import annotations

import math

import bpy

from modeling.body import SurfaceBuilder, tube_rings


def _head_rings(sides: int = 80) -> list[list[tuple[float, float, float]]]:
    """Return cranial sections with Astra's tapered jaw and soft cheek planes.

    Face is oriented toward negative Y.  The first two sections live inside the
    neck union; the visible chin starts at 1.49 m and the crown ends at 1.73 m.
    This keeps the adult 7.5--8 head silhouette from the reference instead of the
    former oversized, rectangular head.
    """

    sections = (
        # z, half-width, anterior depth, posterior depth, centre-y
        (1.445, 0.054, 0.052, 0.062, 0.006),  # hidden neck overlap
        (1.465, 0.054, 0.057, 0.067, 0.006),
        (1.482, 0.045, 0.068, 0.071, 0.006),  # underside of the jaw
        (1.493, 0.025, 0.082, 0.074, 0.005),  # compact rounded chin
        (1.507, 0.039, 0.084, 0.078, 0.006),
        (1.525, 0.055, 0.083, 0.084, 0.007),
        (1.546, 0.069, 0.082, 0.093, 0.008),
        (1.568, 0.077, 0.084, 0.102, 0.009),  # cheek maximum
        (1.590, 0.081, 0.083, 0.109, 0.010),
        (1.614, 0.082, 0.082, 0.113, 0.011),  # eye line
        (1.638, 0.082, 0.081, 0.114, 0.012),
        (1.660, 0.082, 0.080, 0.112, 0.012),
        (1.680, 0.084, 0.080, 0.107, 0.012),
        (1.697, 0.078, 0.076, 0.097, 0.011),
        (1.711, 0.068, 0.068, 0.083, 0.010),
        (1.721, 0.052, 0.057, 0.063, 0.009),
        (1.728, 0.032, 0.039, 0.038, 0.008),
        (1.732, 0.010, 0.017, 0.014, 0.007),
    )

    rings: list[list[tuple[float, float, float]]] = []
    for z, width, front, rear, center_y in sections:
        ring: list[tuple[float, float, float]] = []
        for index in range(sides):
            angle = 2.0 * math.pi * index / sides
            ca, sa = math.cos(angle), math.sin(angle)
            # A nearly elliptical rear skull keeps the profile round.  The front
            # uses a lower sine exponent to establish a broad, calm anime facial
            # plane rather than a cylindrical muzzle.
            # Superellipse exponent above one adds the soft cheek/temple planes
            # visible in ASTRA's three-quarter portrait without reverting to a
            # rectangular mask silhouette.
            x = width * math.copysign(abs(ca) ** 1.16, ca)
            if sa < 0.0:
                y = center_y - front * abs(sa) ** 0.97
                ax = abs(x)

                # Soft cheek pad: the reference is youthful, but the volume stays
                # lateral and never widens the jaw into a square silhouette.
                cheek = (
                    math.exp(-((ax - 0.057) / 0.030) ** 2)
                    * math.exp(-((z - 1.570) / 0.040) ** 2)
                    * abs(sa) ** 1.8
                )
                y -= 0.0030 * cheek

                # Seat both enlarged anime eyes inside shallow orbital planes.
                # This prevents the sclera and lid curves from reading as parts
                # pasted onto an otherwise uninterrupted forehead mask.
                sockets = sum(
                    math.exp(-((x - sign * 0.038) / 0.030) ** 2)
                    for sign in (-1.0, 1.0)
                )
                sockets *= (
                    math.exp(-((z - 1.613) / 0.023) ** 2)
                    * abs(sa) ** 2.2
                )
                y += 0.0055 * sockets

                # A continuous, narrow nose bridge belongs to the head surface;
                # the compact tip below is also a coordinate deformation.
                bridge = (
                    math.exp(-(ax / 0.016) ** 2)
                    * math.exp(-((z - 1.605) / 0.047) ** 2)
                    * abs(sa) ** 2.2
                )
                y -= 0.0070 * bridge

                # Closed nose tip and alar transition are deformations of the
                # same head surface; there can be no detached/open underside.
                tip = (
                    math.exp(-(ax / 0.014) ** 2)
                    * math.exp(-((z - 1.576) / 0.015) ** 2)
                    * abs(sa) ** 2.5
                )
                alar = sum(
                    math.exp(-((x - sign * 0.0105) / 0.0075) ** 2)
                    for sign in (-1.0, 1.0)
                )
                alar *= (
                    math.exp(-((z - 1.570) / 0.010) ** 2)
                    * abs(sa) ** 2.4
                )
                y -= 0.0230 * tip + 0.0045 * alar

                # Very slight mouth/philtrum plane; lip colour and the mouth seam
                # remain independent riggable landmarks.
                muzzle = (
                    math.exp(-(ax / 0.035) ** 2)
                    * math.exp(-((z - 1.548) / 0.026) ** 2)
                    * abs(sa) ** 2.0
                )
                upper_lip = (
                    math.exp(-(ax / 0.025) ** 2)
                    * math.exp(-((z - 1.5495) / 0.0075) ** 2)
                    * abs(sa) ** 2.2
                )
                lower_lip = (
                    math.exp(-(ax / 0.024) ** 2)
                    * math.exp(-((z - 1.5405) / 0.0080) ** 2)
                    * abs(sa) ** 2.2
                )
                chin_pad = (
                    math.exp(-(ax / 0.028) ** 2)
                    * math.exp(-((z - 1.515) / 0.015) ** 2)
                    * abs(sa) ** 2.0
                )
                y -= 0.0025 * muzzle + 0.0045 * upper_lip + 0.0038 * lower_lip
                y -= 0.0045 * chin_pad
            else:
                # A near-elliptic occiput is visibly round in profile instead of
                # ending in the rejected vertical/flat rear plane.
                y = center_y + rear * abs(sa) ** 0.99
            ring.append((x, y, z))
        rings.append(ring)
    return rings


def add_head_to_scaffold(builder: SurfaceBuilder) -> None:
    """Append the continuous head, neck transition, nose and ears."""

    builder.add_loft(_head_rings())

    # Two nested neck lofts overlap torso and jaw.  Their upper sections stay
    # behind the projected chin, retaining a real jaw/neck break in profile.
    neck_points = ((0.0, 0.007, 1.392), (0.0, 0.009, 1.425), (0.0, 0.012, 1.468))
    neck_radii = ((0.088, 0.081), (0.071, 0.064), (0.053, 0.049))
    builder.add_loft(tube_rings(neck_points, neck_radii, sides=40))
    bridge_points = ((0.0, 0.007, 1.405), (0.0, 0.009, 1.438), (0.0, 0.011, 1.471))
    bridge_radii = ((0.076, 0.068), (0.064, 0.057), (0.051, 0.047))
    builder.add_loft(tube_rings(bridge_points, bridge_radii, sides=32))

    # Low-profile ears follow the eye-to-nose interval and will sit naturally
    # beneath Astra's side locks.  Extra additive "inner ear" blobs are avoided.
    for sign in (-1.0, 1.0):
        builder.add_lathe_ellipsoid(
            (sign * 0.096, 0.006, 1.590),
            (0.008, 0.010, 0.020),
            radial=24,
            vertical=14,
        )

    # A compact continuous nasal bulb survives the 7.5 mm watertight remesh and
    # gives the side silhouette the bridge/tip break visible on the turnaround.
    # It overlaps the sculpted bridge and is unioned into BODY_CONTINUOUS later.
    builder.add_lathe_ellipsoid(
        (0.0, -0.087, 1.575),
        (0.0090, 0.0100, 0.0090),
        radial=28,
        vertical=16,
        front_taper=0.0015,
    )


def _closed_almond(
    center_x: float,
    sign: float,
    center_z: float = 1.615,
    half_width: float = 0.022,
    upper: float = 0.0105,
    lower: float = 0.0068,
    segments: int = 36,
) -> SurfaceBuilder:
    """Create a shallow closed almond lens aligned to the facial plane."""

    builder = SurfaceBuilder()
    ring: list[tuple[float, float, float]] = []
    for index in range(segments):
        theta = 2.0 * math.pi * index / segments
        c, s = math.cos(theta), math.sin(theta)
        x = center_x + half_width * c
        height = upper if s >= 0.0 else lower
        # The sheet keeps the inner canthus slightly lower than the outer corner.
        outward = sign * (x - center_x) / half_width
        z = center_z + height * math.copysign(abs(s) ** 0.72, s) + 0.0018 * outward
        # Keep the sclera flush to the locally sculpted socket so the eyelids,
        # not a protruding eyeball, define the profile silhouette.
        # Follow the curved facial plane: eye corners sit slightly farther back
        # than the centre, avoiding paper-thin features floating in side view.
        y = -0.0740 + 0.0060 * abs(c)
        ring.append((x, y, z))

    builder.vertices.extend(ring)
    # A single planar fan is intentionally used instead of a lens/ellipsoid: the
    # painted-anime sclera must stay flush and has no visible side wall.
    center = len(builder.vertices)
    builder.vertices.append((center_x, -0.0750, center_z + 0.0010))
    for index in range(segments):
        nxt = (index + 1) % segments
        builder.faces.append((center, index, nxt))
    return builder


def _object_from_builder(name: str, builder: SurfaceBuilder) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(builder.vertices, [], builder.faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def create_eye_objects() -> list[bpy.types.Object]:
    """Create flush almond eye lenses with cyan iris, pupil and highlights."""

    created: list[bpy.types.Object] = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        center_x = sign * 0.038
        created.append(
            _object_from_builder(
                f"EYE_{suffix}",
                _closed_almond(
                    center_x,
                    sign,
                    center_z=1.614,
                    half_width=0.0240,
                    upper=0.0105,
                    lower=0.0065,
                ),
            )
        )

        iris = SurfaceBuilder()
        iris.add_lathe_ellipsoid(
            (center_x, -0.0756, 1.6145),
            (0.0078, 0.00038, 0.0060),
            radial=32,
            vertical=16,
            front_taper=0.0003,
        )
        created.append(_object_from_builder(f"IRIS_{suffix}", iris))

        pupil = SurfaceBuilder()
        pupil.add_lathe_ellipsoid(
            (center_x, -0.0762, 1.6145),
            (0.0032, 0.00030, 0.0041),
            radial=24,
            vertical=12,
            front_taper=0.0002,
        )
        created.append(_object_from_builder(f"PUPIL_{suffix}", pupil))

        # Two unequal highlights avoid the artificial single-dot doll stare.
        for highlight_index, (dx, dz, rx, rz) in enumerate(
            ((-0.0025, 0.0035, 0.0022, 0.0026), (0.0028, -0.0024, 0.0010, 0.0013)),
            start=1,
        ):
            highlight = SurfaceBuilder()
            highlight.add_lathe_ellipsoid(
                (center_x + dx, -0.0766, 1.6145 + dz),
                (rx, 0.00020, rz),
                radial=18,
                vertical=10,
            )
            created.append(
                _object_from_builder(f"EYE_HIGHLIGHT_{highlight_index}_{suffix}", highlight)
            )
    return created


def create_eyelids() -> list[bpy.types.Object]:
    """Create smooth tapered upper and lower lid curves around each almond."""

    created: list[bpy.types.Object] = []
    samples = 17
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        center_x = sign * 0.038
        for upper_lid, label in ((True, "UPPER"), (False, "LOWER")):
            points: list[tuple[float, float, float]] = []
            radii: list[tuple[float, float]] = []
            for index in range(samples):
                t = index / (samples - 1)
                # Travel inner -> outer for both sides.
                inner_x = sign * 0.016
                outer_x = sign * 0.060
                x = inner_x + (outer_x - inner_x) * t
                arch = math.sin(math.pi * t) ** 0.74
                if upper_lid:
                    z = 1.613 + 0.0102 * arch + 0.0018 * t
                    radius = 0.00075 + 0.00110 * math.sin(math.pi * t)
                    y = -0.0769
                else:
                    z = 1.613 - 0.0060 * arch + 0.0015 * t
                    radius = 0.00038 + 0.00042 * math.sin(math.pi * t)
                    y = -0.0763
                points.append((x, y, z))
                radii.append((radius, radius * 0.72))
            builder = SurfaceBuilder()
            builder.add_loft(tube_rings(points, radii, sides=10))
            created.append(_object_from_builder(f"EYELID_{label}_{suffix}", builder))
        # Dark tapered outer lashes define an adult anime gaze without turning
        # the whole upper lid into a heavy black bar. Naming them as brow accents
        # gives the existing material system the correct dark hair-line shader.
        lash_points: list[tuple[float, float, float]] = []
        lash_radii: list[tuple[float, float]] = []
        for index in range(9):
            t = index / 8
            x = sign * (0.044 + 0.018 * t)
            z = 1.6208 - 0.0048 * t + 0.0015 * math.sin(math.pi * t)
            lash_points.append((x, -0.0774, z))
            radius = 0.00085 * (1.0 - 0.72 * t)
            lash_radii.append((radius, radius * 0.65))
        lash = SurfaceBuilder()
        lash.add_loft(tube_rings(lash_points, lash_radii, sides=8))
        created.append(_object_from_builder(f"EYEBROW_LASH_{suffix}", lash))
    return created


def create_brows() -> list[bpy.types.Object]:
    """Create soft continuous brow arches rather than three-point bars."""

    created: list[bpy.types.Object] = []
    samples = 13
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        points: list[tuple[float, float, float]] = []
        radii: list[tuple[float, float]] = []
        inner_x = sign * 0.013
        outer_x = sign * 0.069
        for index in range(samples):
            t = index / (samples - 1)
            x = inner_x + (outer_x - inner_x) * t
            z = 1.6435 + 0.0048 * math.sin(math.pi * t) - 0.0022 * t
            y = -0.0735 + 0.0008 * abs(t - 0.5)
            radius = 0.00062 + 0.00062 * math.sin(math.pi * t)
            points.append((x, y, z))
            radii.append((radius, radius * 0.72))
        builder = SurfaceBuilder()
        builder.add_loft(tube_rings(points, radii, sides=10))
        created.append(_object_from_builder(f"EYEBROW_{suffix}", builder))
    return created


def create_mouth_features() -> list[bpy.types.Object]:
    """Create a restrained seam plus shallow upper/lower lip highlight forms."""

    points: list[tuple[float, float, float]] = []
    radii: list[tuple[float, float]] = []
    samples = 15
    for index in range(samples):
        t = -1.0 + 2.0 * index / (samples - 1)
        # A tiny central cupid dip and lifted corners keep the neutral expression
        # alive without adding the former protruding pair of lip ellipsoids.
        z = 1.5450 - 0.0012 * (1.0 - abs(t)) + 0.0008 * abs(t) ** 2
        points.append((0.022 * t, -0.0872, z))
        radius = 0.00050 + 0.00045 * (1.0 - abs(t))
        radii.append((radius, radius * 0.72))
    builder = SurfaceBuilder()
    builder.add_loft(tube_rings(points, radii, sides=10))
    created = [_object_from_builder("MOUTH_INNER", builder)]
    for label, center_z, bulge, thickness in (
        ("UPPER", 1.5470, 0.0014, 0.00048),
        ("LOWER", 1.5422, -0.0005, 0.00054),
    ):
        lip_points: list[tuple[float, float, float]] = []
        lip_radii: list[tuple[float, float]] = []
        for index in range(samples):
            t = -1.0 + 2.0 * index / (samples - 1)
            arch = 1.0 - t * t
            lip_points.append((0.0205 * t, -0.0863, center_z + bulge * arch))
            radius = thickness * (0.30 + 0.70 * arch)
            lip_radii.append((radius, radius * 0.62))
        lip = SurfaceBuilder()
        lip.add_loft(tube_rings(lip_points, lip_radii, sides=10))
        created.append(_object_from_builder(f"MOUTH_LIP_{label}", lip))
    return created
