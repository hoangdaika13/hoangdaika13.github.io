"""From-scratch anime/game head and facial landmark meshes."""

from __future__ import annotations

import math

import bpy

from modeling.body import SurfaceBuilder, tube_rings


def _head_rings(sides: int = 64) -> list[list[tuple[float, float, float]]]:
    # Cross-sections explicitly encode chin, jaw, cheeks, eye sockets, temples,
    # forehead and cranium. Face points toward negative Y.
    sections = (
        # z, width, front depth, rear depth, centre-y.  The lower rings keep a
        # small anime chin, widen through the jaw and hold a soft cheek plane
        # instead of tapering like a featureless capsule.
        (1.424, 0.044, 0.050, 0.053, 0.003),
        (1.460, 0.062, 0.058, 0.064, 0.002),
        (1.500, 0.078, 0.064, 0.069, 0.002),
        (1.532, 0.101, 0.071, 0.079, 0.004),
        (1.565, 0.112, 0.077, 0.088, 0.007),
        (1.605, 0.112, 0.078, 0.094, 0.010),
        (1.646, 0.108, 0.076, 0.098, 0.012),
        (1.681, 0.101, 0.073, 0.097, 0.013),
        (1.704, 0.082, 0.061, 0.083, 0.012),
        (1.718, 0.058, 0.045, 0.060, 0.010),
        (1.725, 0.030, 0.026, 0.033, 0.008),
        (1.728, 0.010, 0.010, 0.012, 0.006),
    )
    rings: list[list[tuple[float, float, float]]] = []
    for z, width, front, rear, center_y in sections:
        ring: list[tuple[float, float, float]] = []
        for index in range(sides):
            angle = 2.0 * math.pi * index / sides
            ca, sa = math.cos(angle), math.sin(angle)
            x = width * math.copysign(abs(ca) ** 0.86, ca)
            depth = front if sa < 0.0 else rear
            y = center_y + depth * math.copysign(abs(sa) ** 0.91, sa)
            # Flatten the central face plane around the eyes and mouth while keeping
            # cheeks full. This is a coordinate deformation, not a sphere head.
            medial = 1.0 - min(1.0, abs(x) / max(width, 1e-5))
            if sa < 0.0 and 1.51 < z < 1.67:
                y += 0.008 * medial * abs(sa)
            # Slightly fuller lateral cheek, with a smooth return into temple and
            # jaw; this reads as a face rather than a lathed helmet in 3/4 view.
            cheek = math.exp(-((z - 1.565) / 0.060) ** 2)
            x *= 1.0 + 0.055 * cheek * (0.35 + 0.65 * medial)
            ring.append((x, y, 1.590 + (z - 1.590) * 0.96))
        rings.append(ring)
    return rings


def _add_nose(builder: SurfaceBuilder) -> None:
    # A tapered, slightly upturned anime nose bridge/tip built as y-axis sections.
    points = (
        (0.000, -0.071, 1.625),
        (0.000, -0.079, 1.608),
        (0.000, -0.087, 1.590),
        (0.000, -0.094, 1.579),
        (0.000, -0.089, 1.571),
    )
    # tube_rings maps the first radius to the vertical axis and the second to X for
    # this forward-running centre line: narrow anime nose, never a wide snout.
    radii = ((0.017, 0.007), (0.015, 0.007), (0.013, 0.008), (0.010, 0.011), (0.005, 0.007))
    builder.add_loft(tube_rings(points, radii, sides=20))
    # Alar wings remain subtle but ensure the silhouette is real geometry.
    builder.add_lathe_ellipsoid((-0.010, -0.087, 1.571), (0.008, 0.007, 0.005), 20, 10)
    builder.add_lathe_ellipsoid((0.010, -0.087, 1.571), (0.008, 0.007, 0.005), 20, 10)


def _add_lips(builder: SurfaceBuilder) -> None:
    # Upper and lower lip lobes intersect the facial plane and survive remeshing as
    # a soft mouth opening instead of a painted line.
    builder.add_lathe_ellipsoid((0.000, -0.068, 1.550), (0.031, 0.012, 0.005), 28, 10, 0.001)
    builder.add_lathe_ellipsoid((0.000, -0.069, 1.540), (0.028, 0.011, 0.0055), 28, 10, 0.001)


def _add_face_masses(builder: SurfaceBuilder) -> None:
    """Integrate cheeks, jaw and chin into the continuous remeshed head."""
    # The cross-section rings already carry the face volume.  Keep cheek/jaw
    # deformation coordinate-based here; detached overlapping masses can fall
    # below the voxel union threshold and split the watertight island.
    return


def add_head_to_scaffold(builder: SurfaceBuilder) -> None:
    builder.add_loft(_head_rings())
    # Neck transitions overlap both the torso neck ring and jaw, creating one mesh.
    neck_points = ((0.0, 0.006, 1.392), (0.0, 0.007, 1.425), (0.0, 0.008, 1.462))
    neck_radii = ((0.098, 0.090), (0.080, 0.074), (0.068, 0.064))
    builder.add_loft(tube_rings(neck_points, neck_radii, sides=40))
    # Small internal bridge guarantees the compact chin and slim neck union remain
    # one watertight island after the fine voxel remesh.
    bridge_points = ((0.0, 0.006, 1.402), (0.0, 0.006, 1.435), (0.0, 0.006, 1.470))
    bridge_radii = ((0.084, 0.076), (0.072, 0.066), (0.061, 0.056))
    builder.add_loft(tube_rings(bridge_points, bridge_radii, sides=32))
    _add_nose(builder)
    _add_lips(builder)
    _add_face_masses(builder)
    # Proper ears are tapered ellipsoids with a second inner relief mass.
    for sign in (-1.0, 1.0):
        builder.add_lathe_ellipsoid((sign * 0.101, 0.006, 1.588), (0.011, 0.014, 0.025), 24, 14)
        builder.add_lathe_ellipsoid((sign * 0.104, -0.002, 1.588), (0.004, 0.007, 0.014), 18, 10)


def create_eye_objects() -> list[bpy.types.Object]:
    """Create allowed spherical eyeballs and separate iris/cornea relief."""
    created: list[bpy.types.Object] = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        builder = SurfaceBuilder()
        # Ellipsoid is constructed from vertices/faces, never bpy.ops primitive_add.
        # Eyes are positioned against the socket plane.  The body voxel union
        # only needs the eye volume to overlap the face; the iris/highlight
        # reliefs then sit forward for the close-up.
        builder.add_lathe_ellipsoid((sign * 0.041, -0.040, 1.612), (0.023, 0.019, 0.018), 36, 20, 0.001)
        mesh = bpy.data.meshes.new(f"EYE_{suffix}_MESH")
        mesh.from_pydata(builder.vertices, [], builder.faces)
        mesh.update(calc_edges=True)
        obj = bpy.data.objects.new(f"EYE_{suffix}", mesh)
        bpy.context.collection.objects.link(obj)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        created.append(obj)

        iris = SurfaceBuilder()
        iris.add_lathe_ellipsoid((sign * 0.041, -0.066, 1.612), (0.0105, 0.0022, 0.0125), 28, 12, 0.0003)
        iris_mesh = bpy.data.meshes.new(f"IRIS_{suffix}_MESH")
        iris_mesh.from_pydata(iris.vertices, [], iris.faces)
        iris_mesh.update(calc_edges=True)
        iris_obj = bpy.data.objects.new(f"IRIS_{suffix}", iris_mesh)
        bpy.context.collection.objects.link(iris_obj)
        for polygon in iris_mesh.polygons:
            polygon.use_smooth = True
        created.append(iris_obj)

        pupil = SurfaceBuilder()
        pupil.add_lathe_ellipsoid((sign * 0.041, -0.070, 1.612), (0.0048, 0.0015, 0.0072), 20, 10, 0.0001)
        pupil_mesh = bpy.data.meshes.new(f"PUPIL_{suffix}_MESH")
        pupil_mesh.from_pydata(pupil.vertices, [], pupil.faces)
        pupil_mesh.update(calc_edges=True)
        pupil_obj = bpy.data.objects.new(f"PUPIL_{suffix}", pupil_mesh)
        bpy.context.collection.objects.link(pupil_obj)
        created.append(pupil_obj)

        highlight = SurfaceBuilder()
        highlight.add_lathe_ellipsoid((sign * 0.037, -0.072, 1.620), (0.0024, 0.0010, 0.0030), 16, 8, 0.0001)
        highlight_mesh = bpy.data.meshes.new(f"EYE_HIGHLIGHT_{suffix}_MESH")
        highlight_mesh.from_pydata(highlight.vertices, [], highlight.faces)
        highlight_mesh.update(calc_edges=True)
        highlight_obj = bpy.data.objects.new(f"EYE_HIGHLIGHT_{suffix}", highlight_mesh)
        bpy.context.collection.objects.link(highlight_obj)
        created.append(highlight_obj)
    return created


def create_eyelids() -> list[bpy.types.Object]:
    """Polygon eyelid arcs around the eye opening, ready for later face rigging."""
    created: list[bpy.types.Object] = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        for upper, label in ((True, "UPPER"), (False, "LOWER")):
            points = []
            radii = []
            for i in range(7):
                t = -1.0 + 2.0 * i / 6.0
                x = sign * 0.041 + 0.031 * t
                arc = (1.0 - t * t) * (0.015 if upper else -0.009)
                z = 1.612 + arc
                points.append((x, -0.066, z))
                radii.append((0.0015, 0.0012))
            builder = SurfaceBuilder()
            builder.add_loft(tube_rings(points, radii, sides=10))
            mesh = bpy.data.meshes.new(f"EYELID_{label}_{suffix}_MESH")
            mesh.from_pydata(builder.vertices, [], builder.faces)
            mesh.update(calc_edges=True)
            obj = bpy.data.objects.new(f"EYELID_{label}_{suffix}", mesh)
            bpy.context.collection.objects.link(obj)
            for polygon in mesh.polygons:
                polygon.use_smooth = True
            created.append(obj)
    return created


def create_brows() -> list[bpy.types.Object]:
    """Low-poly tapered brow ridges that frame the embedded anime eyes."""
    created: list[bpy.types.Object] = []
    for sign, suffix in ((-1.0, "L"), (1.0, "R")):
        points = [
            (sign * 0.070, -0.067, 1.646),
            (sign * 0.046, -0.070, 1.653),
            (sign * 0.018, -0.068, 1.648),
        ]
        builder = SurfaceBuilder()
        builder.add_loft(tube_rings(points, ((0.0032, 0.0016),) * 3, sides=10))
        mesh = bpy.data.meshes.new(f"EYEBROW_{suffix}_MESH")
        mesh.from_pydata(builder.vertices, [], builder.faces)
        mesh.update(calc_edges=True)
        obj = bpy.data.objects.new(f"EYEBROW_{suffix}", mesh)
        bpy.context.collection.objects.link(obj)
        for polygon in mesh.polygons:
            polygon.use_smooth = True
        created.append(obj)
    return created


def create_mouth_features() -> list[bpy.types.Object]:
    """A recessed mouth line gives the close-up a readable expression landmark."""
    builder = SurfaceBuilder()
    builder.add_lathe_ellipsoid((0.0, -0.091, 1.546), (0.021, 0.0022, 0.0045), 24, 8, 0.0001)
    mesh = bpy.data.meshes.new("MOUTH_INNER_MESH")
    mesh.from_pydata(builder.vertices, [], builder.faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new("MOUTH_INNER", mesh)
    bpy.context.collection.objects.link(obj)
    return [obj]
