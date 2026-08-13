"""Procedural, from-scratch female humanoid body generation.

No external model data and no Blender primitive mesh operators are used here.  The
scaffold is built explicitly from anatomical cross-section loops and converted to
one watertight surface by Blender's voxel remesher.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Sequence

import bpy
from mathutils import Vector


@dataclass
class SurfaceBuilder:
    vertices: list[tuple[float, float, float]]
    faces: list[tuple[int, ...]]

    def __init__(self) -> None:
        self.vertices = []
        self.faces = []

    def add_loft(
        self,
        rings: Sequence[Sequence[tuple[float, float, float]]],
        cap_start: bool = True,
        cap_end: bool = True,
    ) -> None:
        if len(rings) < 2:
            raise ValueError("A loft needs at least two cross-section rings")
        sides = len(rings[0])
        if sides < 3 or any(len(ring) != sides for ring in rings):
            raise ValueError("All loft rings must have the same vertex count")

        offsets: list[int] = []
        for ring in rings:
            offsets.append(len(self.vertices))
            self.vertices.extend(ring)
        for ring_index in range(len(rings) - 1):
            a = offsets[ring_index]
            b = offsets[ring_index + 1]
            for side in range(sides):
                nxt = (side + 1) % sides
                self.faces.append((a + side, a + nxt, b + nxt, b + side))
        if cap_start:
            self.faces.append(tuple(reversed([offsets[0] + i for i in range(sides)])))
        if cap_end:
            self.faces.append(tuple(offsets[-1] + i for i in range(sides)))

    def add_lathe_ellipsoid(
        self,
        center: tuple[float, float, float],
        radii: tuple[float, float, float],
        radial: int = 32,
        vertical: int = 18,
        front_taper: float = 0.0,
    ) -> None:
        """Create an analytic ellipsoid without invoking a primitive operator."""
        cx, cy, cz = center
        rx, ry, rz = radii
        rings: list[list[tuple[float, float, float]]] = []
        eps = 0.012
        for j in range(vertical + 1):
            phi = -math.pi / 2.0 + math.pi * j / vertical
            ring: list[tuple[float, float, float]] = []
            ring_scale = max(eps, math.cos(phi))
            for i in range(radial):
                theta = 2.0 * math.pi * i / radial
                x = cx + rx * ring_scale * math.cos(theta)
                y_wave = math.sin(theta)
                y = cy + ry * ring_scale * y_wave
                if front_taper and y_wave < 0.0:
                    y -= front_taper * ring_scale * ring_scale
                z = cz + rz * math.sin(phi)
                ring.append((x, y, z))
            rings.append(ring)
        self.add_loft(rings)


def _signed_power(value: float, exponent: float) -> float:
    return math.copysign(abs(value) ** exponent, value)


def torso_rings(sides: int = 64) -> list[list[tuple[float, float, float]]]:
    """Anatomical sections from the lower pelvis to the neck base.

    The non-circular exponents give a rib cage, waist and pelvic silhouette rather
    than a stack of circular tubes.  Front/back offsets also encode lumbar posture.
    """
    sections = (
        # z, half-width, half-depth, centre-y, horizontal exponent, vertical exponent
        # lower pelvis begins inside the thigh roots; the Catmull-Rom sections below
        # remove the former shelf-like horizontal bands at the crotch and waist.
        (0.810, 0.090, 0.078, 0.008, 0.98, 0.99),
        (0.835, 0.125, 0.098, 0.010, 0.96, 0.98),
        (0.870, 0.155, 0.116, 0.012, 0.92, 0.95),
        (0.910, 0.172, 0.126, 0.014, 0.89, 0.92),
        (0.945, 0.181, 0.131, 0.016, 0.88, 0.91),
        (0.980, 0.178, 0.128, 0.012, 0.90, 0.93),
        (1.015, 0.174, 0.123, 0.004, 0.92, 0.95),
        (1.055, 0.145, 0.108, -0.002, 0.96, 0.98),
        (1.105, 0.143, 0.106, -0.004, 0.96, 0.98),
        (1.160, 0.166, 0.119, -0.003, 0.94, 0.96),
        (1.220, 0.194, 0.136, -0.002, 0.92, 0.94),
        (1.280, 0.207, 0.141, 0.000, 0.91, 0.93),
        (1.335, 0.204, 0.137, 0.002, 0.92, 0.94),
        (1.385, 0.205, 0.132, 0.004, 0.93, 0.95),
        (1.425, 0.170, 0.110, 0.006, 0.96, 0.98),
        (1.450, 0.082, 0.072, 0.006, 0.98, 0.99),
    )
    rings: list[list[tuple[float, float, float]]] = []
    for section_index, (z, width, depth, center_y, exp_x, exp_y) in enumerate(sections):
        ring: list[tuple[float, float, float]] = []
        for i in range(sides):
            angle = 2.0 * math.pi * i / sides
            ca, sa = math.cos(angle), math.sin(angle)
            local_z = z
            x = width * _signed_power(ca, exp_x)
            y = center_y + depth * _signed_power(sa, exp_y)

            # Preserve the same angular correspondence across all rings. Without
            # this correction a very narrow pelvis ring is connected directly to
            # a wide hip ring at equal angle and can fold through the centre after
            # Catmull-Rom interpolation. A mild centreline inset retains a natural
            # medial pelvis while preventing self-intersection.
            if section_index < 3:
                inset = (0.030, 0.018, 0.006)[section_index]
                x += math.copysign(inset * (1.0 - abs(ca)) ** 2.0, ca)

            # The chest volume belongs to the rib-cage surface.  Extending only
            # the anterior quadrants here produces a natural breast root and
            # under-bust transition; joining separate ellipsoids created the
            # button-like protrusions visible in the previous QA render.
            if sa < 0.0:
                breast_z = math.exp(-((z - 1.292) / 0.086) ** 2)
                breast_x = math.exp(-((abs(x) - 0.071) / 0.057) ** 2)
                # Side/medial weighting leaves a central sternum groove and a
                # softer outer root; the lower half projects slightly more.
                lower_weight = 0.88 + 0.24 * max(0.0, 1.292 - z) / 0.086
                y -= 0.043 * breast_z * breast_x * ((-sa) ** 1.8) * lower_weight

            # Gluteal fullness is likewise part of the pelvis surface.  The
            # compact x/z Gaussian keeps the sacrum shallow while rounding both
            # sides into the upper thighs without a horizontal shelf.
            if sa > 0.0:
                glute_z = math.exp(-((z - 0.930) / 0.092) ** 2)
                glute_x = math.exp(-((abs(x) - 0.105) / 0.082) ** 2)
                y += 0.035 * glute_z * glute_x * (sa ** 1.45)

            # A raised medial underside gives the lowest pelvis rings a true
            # perineal arch instead of leaving a flat capped band between legs.
            if section_index < 3:
                arch_strength = (0.060, 0.034, 0.012)[section_index]
                local_z += arch_strength * ((1.0 - abs(ca)) ** 1.7)
            # A soft spinal groove/back fullness without abrupt topology changes.
            if sa > 0.0:
                y += 0.009 * (1.0 - min(1.0, abs(x) / max(width, 1e-6))) * sa
            ring.append((x, y, local_z))
        rings.append(ring)
    # Catmull-Rom densification gives smooth clavicle/rib/waist/hip curvature while
    # keeping every resulting vertex on a procedurally specified surface.
    dense: list[list[tuple[float, float, float]]] = []
    steps = 4
    for ring_index in range(len(rings) - 1):
        p0 = rings[max(0, ring_index - 1)]
        p1 = rings[ring_index]
        p2 = rings[ring_index + 1]
        p3 = rings[min(len(rings) - 1, ring_index + 2)]
        for step in range(steps):
            t = step / steps
            t2, t3 = t * t, t * t * t
            interpolated: list[tuple[float, float, float]] = []
            for a, b, c, d in zip(p0, p1, p2, p3):
                interpolated.append(tuple(
                    0.5 * ((2.0 * b[axis]) + (-a[axis] + c[axis]) * t
                           + (2.0 * a[axis] - 5.0 * b[axis] + 4.0 * c[axis] - d[axis]) * t2
                           + (-a[axis] + 3.0 * b[axis] - 3.0 * c[axis] + d[axis]) * t3)
                    for axis in range(3)
                ))
            dense.append(interpolated)
    dense.append(rings[-1])
    return dense


def _cosine_falloff(value: float, center: float, radius: float) -> float:
    """Compact C1 falloff used by the procedural sculpt pass."""
    distance = abs(value - center) / max(radius, 1e-6)
    if distance >= 1.0:
        return 0.0
    return 0.5 + 0.5 * math.cos(math.pi * distance)


def sculpt_reference_proportions(obj: bpy.types.Object) -> None:
    """Shape the watertight base toward the authoritative Astra silhouette.

    Voxel union is useful for guaranteeing one manifold component, but it tends to
    round shoulders and leave a rectangular crotch.  This deterministic coordinate
    pass restores anatomical planes without importing sculpt data or external mesh
    coordinates.
    """
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        ax = abs(x)

        # Establish a shallow axilla hollow between the pectoral sidewall and
        # deltoid.  Voxel union correctly makes one surface but otherwise leaves
        # a visible bead where the two procedural lofts overlap.
        if 1.245 < z < 1.355 and 0.155 < ax < 0.245:
            axilla_z = _cosine_falloff(z, 1.295, 0.058)
            axilla_x = _cosine_falloff(ax, 0.198, 0.050)
            weight = axilla_z * axilla_x
            vertex.co.z -= 0.010 * weight
            if y < 0.0:
                vertex.co.y += 0.012 * weight
            else:
                vertex.co.y -= 0.004 * weight

        # Compact the shoulder/upper-arm envelope. Preserve a rounded clavicle
        # slope and avoid a hard shoulder cap/axilla ledge.
        if 1.25 < z < 1.43 and ax > 0.145:
            outer = min(1.0, max(0.0, (ax - 0.145) / 0.17))
            vertex.co.x *= 1.0 - 0.055 * outer
            if 1.22 < z < 1.36 and y < 0.0:
                vertex.co.y += 0.010 * outer * _cosine_falloff(z, 1.30, 0.10)

        # Athletic Astra proportions: reduce rib-cage mass while retaining the
        # breast root, and lower the shoulder line softly into the deltoid.
        if 1.18 < z < 1.40 and ax < 0.23:
            rib = _cosine_falloff(z, 1.285, 0.125)
            side_weight = min(1.0, ax / 0.20)
            vertex.co.x *= 1.0 - 0.095 * rib * side_weight
            if y > 0.0:
                vertex.co.y *= 1.0 - 0.075 * rib
            # Only the lateral front rib cage is flattened; preserve the chest
            # lobes around x=+/-0.07 and create a shallow sternum separation.
            if y < 0.0:
                medial = max(0.0, 1.0 - ax / 0.050)
                lateral = max(0.0, (ax - 0.145) / 0.080)
                vertex.co.y *= 1.0 - rib * (0.09 * medial + 0.07 * lateral)
        if 1.30 < z < 1.43 and 0.10 < ax < 0.25:
            shoulder = min(1.0, max(0.0, (ax - 0.10) / 0.15))
            vertex.co.z -= 0.018 * shoulder * _cosine_falloff(z, 1.365, 0.075)

        # Collarbone ledge and a restrained sternal channel give the fitted suit
        # a readable clavicle/chest plane rather than one inflated barrel.
        if 1.335 < z < 1.405 and ax < 0.18 and y < 0.0:
            clavicle = _cosine_falloff(z, 1.368, 0.038)
            lateral = _cosine_falloff(ax, 0.105, 0.090)
            vertex.co.y -= 0.0045 * clavicle * lateral
        if 1.195 < z < 1.355 and ax < 0.034 and y < 0.0:
            sternum = _cosine_falloff(z, 1.280, 0.095) * (1.0 - ax / 0.034)
            vertex.co.y += 0.006 * sternum

        # Preserve a slim rib cage and lengthen the visible waist; the reference
        # is athletic, not the short barrel silhouette produced by the union.
        if 1.02 < z < 1.30 and ax < 0.24:
            waist = _cosine_falloff(z, 1.105, 0.125)
            vertex.co.x *= 1.0 - 0.135 * waist
            if y > 0.0:
                vertex.co.y *= 1.0 - 0.040 * waist

        # Iliac crest blends continuously into the upper thigh.  Pull the central
        # underside upward to form a shallow perineal arch instead of a flat shelf.
        if 0.80 < z < 0.99:
            pelvis = _cosine_falloff(z, 0.895, 0.105)
            if ax < 0.090 and y < 0.035:
                medial = 1.0 - ax / 0.090
                vertex.co.z += 0.032 * medial * pelvis
                vertex.co.y += 0.010 * medial * pelvis
            elif 0.09 <= ax < 0.23:
                outer = min(1.0, (ax - 0.09) / 0.14)
                vertex.co.x *= 1.0 - 0.025 * outer * pelvis

        # Inguinal crease and gluteal fold are shallow coordinate depressions,
        # not disconnected decorative geometry.  Both improve the hip-to-thigh
        # read while retaining one manifold surface for later deformation.
        if 0.805 < z < 0.955 and 0.060 < ax < 0.185:
            crease_z = _cosine_falloff(z, 0.885, 0.072)
            crease_x = _cosine_falloff(ax, 0.125, 0.070)
            if y < 0.005:
                vertex.co.y += 0.007 * crease_z * crease_x
            elif y > 0.035:
                vertex.co.y -= 0.006 * _cosine_falloff(z, 0.855, 0.055) * crease_x

        # Round the lower abdominal-to-pelvis transition, removing the apparent
        # horizontal crotch shelf while keeping the medial gap continuous.
        if 0.80 < z < 0.91 and ax < 0.18:
            lower = _cosine_falloff(z, 0.855, 0.060)
            vertex.co.z += 0.010 * (1.0 - ax / 0.18) * lower
            vertex.co.y += 0.006 * (1.0 - ax / 0.18) * lower

        # The sheet has long athletic legs: a cleaner inner-thigh gap, subtle knee
        # pinch and a tapered ankle rather than two uniform columns.
        if 0.52 < z < 0.86 and ax < 0.18:
            upper_leg = _cosine_falloff(z, 0.70, 0.19)
            sign = -1.0 if x < 0.0 else 1.0
            vertex.co.x += sign * 0.009 * upper_leg
        # Reduce the front-to-back thigh cylinder and establish a subtle inner
        # adductor plane / outer quadriceps line.
        if 0.50 < z < 0.86 and ax > 0.055:
            thigh = _cosine_falloff(z, 0.69, 0.20)
            if y < 0.0:
                vertex.co.y *= 1.0 - 0.10 * thigh
            else:
                vertex.co.y *= 1.0 - 0.055 * thigh
        if 0.39 < z < 0.54:
            knee = _cosine_falloff(z, 0.465, 0.075)
            vertex.co.x *= 1.0 - 0.045 * knee
            if y < 0.0:
                vertex.co.y -= 0.008 * knee

        # Patella stays subtle, while the rear popliteal notch prevents the knee
        # from reading as a featureless bend in profile.
        if 0.425 < z < 0.510 and ax > 0.070:
            knee_plane = _cosine_falloff(z, 0.468, 0.045)
            if y < -0.015:
                vertex.co.y -= 0.0045 * knee_plane
            elif y > 0.015:
                vertex.co.y -= 0.0060 * knee_plane
        if 0.22 < z < 0.42 and ax > 0.07:
            calf = _cosine_falloff(z, 0.325, 0.115)
            # Calf belly sits posteriorly; flatten the tibial front.
            if y < 0.0:
                vertex.co.y *= 1.0 - 0.10 * calf
            elif y > 0.0:
                vertex.co.y *= 1.0 + 0.04 * calf
        if 0.08 < z < 0.24:
            ankle = _cosine_falloff(z, 0.13, 0.11)
            vertex.co.x *= 1.0 - 0.055 * ankle

        # Wrist/palm continuity: gently narrow the distal forearm while retaining
        # a small palm, avoiding the visible cuff ring in the close-up.
        if 0.74 < z < 0.84 and ax > 0.25:
            wrist = _cosine_falloff(z, 0.795, 0.050)
            vertex.co.x *= 1.0 - 0.045 * wrist

        # Palm, knuckle line and thumb web.  This keeps all digits attached while
        # replacing the remeshed cuff/needle transition seen in the close-up.
        if 0.705 < z < 0.825 and ax > 0.250:
            palm = _cosine_falloff(z, 0.770, 0.064)
            vertex.co.y -= 0.004 * palm
            if ax > 0.305:
                vertex.co.x *= 1.0 - 0.025 * palm
        if 0.735 < z < 0.790 and ax > 0.315:
            thumb_web = _cosine_falloff(z, 0.760, 0.032)
            vertex.co.z += 0.004 * thumb_web

        # A real longitudinal arch and tapered toe box, ready for extracting the
        # armored boot shell in a later phase.
        if z < 0.10 and y < 0.02:
            if -0.19 < y < -0.045:
                arch = math.sin(math.pi * (abs(y) - 0.045) / 0.145)
                if arch > 0.0:
                    vertex.co.z += 0.009 * arch
            if y < -0.17:
                toe = min(1.0, max(0.0, (-y - 0.17) / 0.10))
                vertex.co.x *= 1.0 - 0.18 * toe


def _orthonormal_frame(points: Sequence[Vector], index: int) -> tuple[Vector, Vector]:
    if index == 0:
        tangent = (points[1] - points[0]).normalized()
    elif index == len(points) - 1:
        tangent = (points[-1] - points[-2]).normalized()
    else:
        tangent = (points[index + 1] - points[index - 1]).normalized()
    reference = Vector((0.0, 1.0, 0.0))
    if abs(tangent.dot(reference)) > 0.92:
        reference = Vector((1.0, 0.0, 0.0))
    u = reference.cross(tangent).normalized()
    v = tangent.cross(u).normalized()
    return u, v


def tube_rings(
    points: Sequence[tuple[float, float, float]],
    radii: Sequence[tuple[float, float]],
    sides: int = 24,
    phase: float = 0.0,
) -> list[list[tuple[float, float, float]]]:
    if len(points) != len(radii):
        raise ValueError("Tube points and radii must have the same length")
    vectors = [Vector(point) for point in points]
    result: list[list[tuple[float, float, float]]] = []
    for index, (center, radius) in enumerate(zip(vectors, radii)):
        u, v = _orthonormal_frame(vectors, index)
        ring: list[tuple[float, float, float]] = []
        for side in range(sides):
            angle = 2.0 * math.pi * side / sides + phase
            point = center + u * (radius[0] * math.cos(angle)) + v * (radius[1] * math.sin(angle))
            ring.append(tuple(point))
        result.append(ring)
    return result


def smooth_tube_rings(
    points: Sequence[tuple[float, float, float]],
    radii: Sequence[tuple[float, float]],
    sides: int = 24,
    steps: int = 4,
) -> list[list[tuple[float, float, float]]]:
    """Densify anatomical tube controls before building their surface.

    Linear interpolation between sparse limb controls reads as stacked tapered
    cylinders even after voxel union.  Catmull-Rom sampling yields one continuous
    muscle curve through deltoid, elbow, knee and calf landmarks.
    """
    if len(points) != len(radii):
        raise ValueError("Tube points and radii must have the same length")
    # A tube that crosses or touches the symmetry plane must not be smoothed as a
    # regular limb. Catmull-Rom overshoot there can create a tall zero-width spike
    # after voxel union (most visibly through the face and sternum).
    if any(abs(point[0]) < 1e-6 for point in points):
        return tube_rings(points, radii, sides=sides)
    dense_points: list[tuple[float, float, float]] = []
    dense_radii: list[tuple[float, float]] = []
    for index in range(len(points) - 1):
        p0 = points[max(0, index - 1)]
        p1 = points[index]
        p2 = points[index + 1]
        p3 = points[min(len(points) - 1, index + 2)]
        r0 = radii[max(0, index - 1)]
        r1 = radii[index]
        r2 = radii[index + 1]
        r3 = radii[min(len(radii) - 1, index + 2)]
        for step in range(steps):
            t = step / steps
            t2, t3 = t * t, t * t * t

            def sample(a: float, b: float, c: float, d: float) -> float:
                return 0.5 * ((2.0 * b) + (-a + c) * t
                              + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2
                              + (-a + 3.0 * b - 3.0 * c + d) * t3)

            dense_points.append(tuple(sample(p0[k], p1[k], p2[k], p3[k]) for k in range(3)))
            dense_radii.append(tuple(max(0.001, sample(r0[k], r1[k], r2[k], r3[k])) for k in range(2)))
    dense_points.append(tuple(points[-1]))
    dense_radii.append(tuple(radii[-1]))
    return tube_rings(dense_points, dense_radii, sides=sides)


def add_arms(builder: SurfaceBuilder) -> None:
    for sign in (-1.0, 1.0):
        points = (
            (sign * 0.164, 0.004, 1.362),
            (sign * 0.184, 0.004, 1.338),
            (sign * 0.207, 0.002, 1.292),
            (sign * 0.224, 0.000, 1.238),
            (sign * 0.239, -0.002, 1.168),
            (sign * 0.254, -0.004, 1.092),
            (sign * 0.270, -0.008, 1.020),
            (sign * 0.286, -0.012, 0.950),
            (sign * 0.318, -0.016, 0.875),
            (sign * 0.332, -0.018, 0.825),
        )
        radii = (
            (0.037, 0.043),
            (0.044, 0.050),
            (0.050, 0.056),
            (0.048, 0.054),
            (0.046, 0.052),
            (0.041, 0.047),
            (0.044, 0.049),
            (0.039, 0.044),
            (0.033, 0.038),
            (0.028, 0.032),
        )
        builder.add_loft(smooth_tube_rings(points, radii, sides=32, steps=5))


def add_legs(builder: SurfaceBuilder) -> None:
    for sign in (-1.0, 1.0):
        points = (
            (sign * 0.120, 0.012, 0.935),
            (sign * 0.132, 0.010, 0.890),
            (sign * 0.140, 0.008, 0.820),
            (sign * 0.143, 0.005, 0.720),
            (sign * 0.142, 0.002, 0.595),
            (sign * 0.139, -0.002, 0.515),
            (sign * 0.138, -0.004, 0.470),
            (sign * 0.140, 0.002, 0.405),
            (sign * 0.142, 0.010, 0.335),
            (sign * 0.141, 0.010, 0.255),
            (sign * 0.138, 0.004, 0.165),
            (sign * 0.136, -0.004, 0.095),
        )
        radii = (
            (0.078, 0.094),
            (0.086, 0.101),
            (0.087, 0.102),
            (0.083, 0.097),
            (0.076, 0.090),
            (0.067, 0.076),
            (0.066, 0.073),
            (0.069, 0.077),
            (0.071, 0.079),
            (0.061, 0.069),
            (0.047, 0.053),
            (0.038, 0.043),
        )
        builder.add_loft(smooth_tube_rings(points, radii, sides=36, steps=5))

        # Foot cross-sections travel from heel to toe along the forward (-Y) axis.
        # Explicit x/z rings along Y give a low heel, longitudinal arch, ball and
        # rounded toe instead of the previous rectangular shoe block.
        foot_sections = (
            # y, bottom-z, top-z, half-width.  A nearly level contact surface,
            # lifted medial arch, high instep and tapered toe read as a foot from
            # both side and three-quarter views.
            (0.074, 0.021, 0.090, 0.026),
            (0.052, 0.014, 0.108, 0.039),
            (0.018, 0.014, 0.116, 0.047),
            (-0.028, 0.022, 0.112, 0.051),
            (-0.078, 0.029, 0.096, 0.054),
            (-0.126, 0.018, 0.078, 0.058),
            (-0.168, 0.014, 0.061, 0.055),
            (-0.202, 0.014, 0.048, 0.040),
            (-0.222, 0.017, 0.038, 0.018),
        )
        foot_rings: list[list[tuple[float, float, float]]] = []
        for y, bottom, top, width in foot_sections:
            ring = []
            for side in range(28):
                angle = 2.0 * math.pi * side / 28
                z = (bottom + top) * 0.5 + (top - bottom) * 0.5 * math.sin(angle)
                ring.append((sign * (0.136 + width * math.cos(angle)), y,
                             z))
            foot_rings.append(ring)
        # These sections already encode an intentionally asymmetric sole/instep,
        # so densify each corresponding vertex rather than treating the foot as
        # a circular tube.
        dense_foot: list[list[tuple[float, float, float]]] = []
        for index in range(len(foot_rings) - 1):
            p0 = foot_rings[max(0, index - 1)]
            p1 = foot_rings[index]
            p2 = foot_rings[index + 1]
            p3 = foot_rings[min(len(foot_rings) - 1, index + 2)]
            for step in range(4):
                t = step / 4
                t2, t3 = t * t, t * t * t
                dense_foot.append([
                    tuple(0.5 * ((2.0 * b[k]) + (-a[k] + c[k]) * t
                                 + (2.0 * a[k] - 5.0 * b[k] + 4.0 * c[k] - d[k]) * t2
                                 + (-a[k] + 3.0 * b[k] - 3.0 * c[k] + d[k]) * t3)
                          for k in range(3))
                    for a, b, c, d in zip(p0, p1, p2, p3)
                ])
        dense_foot.append(foot_rings[-1])
        builder.add_loft(dense_foot)


def add_hands(builder: SurfaceBuilder) -> None:
    """Add a palm plus five individually articulated finger silhouettes per hand."""
    for sign in (-1.0, 1.0):
        # Leave a real topological air gap between hands and hips.  At the old
        # 0.292 centre the voxel union welded the inner palm/forearm to the outer
        # hip; opposing arm/leg weights then tore that bridge into long triangles.
        hand_x = 0.332
        palm_points = (
            (sign * hand_x, -0.018, 0.832),
            (sign * (hand_x + 0.004), -0.021, 0.800),
            (sign * (hand_x + 0.008), -0.025, 0.765),
            (sign * (hand_x + 0.011), -0.028, 0.738),
        )
        palm_radii = ((0.030, 0.025), (0.034, 0.024), (0.036, 0.022), (0.033, 0.019))
        builder.add_loft(smooth_tube_rings(palm_points, palm_radii, sides=24, steps=5))

        # Four fingers. Each has six cross sections marking MCP, proximal, PIP,
        # middle, DIP and fingertip, so the final render reads as real digits.
        # Keep the four digits separated after the 7.5 mm voxel union.  The
        # earlier 17–18 mm center spacing was almost exactly two finger
        # diameters, so remeshing fused the proximal phalanges into a mitten.
        finger_offsets = (-0.037, -0.0125, 0.0125, 0.037)
        finger_lengths = (0.066, 0.078, 0.074, 0.061)
        for finger_index, (offset, length) in enumerate(zip(finger_offsets, finger_lengths)):
            x_base = sign * (hand_x + 0.011 + offset * sign)
            splay = (finger_index - 1.5) * 0.0045
            points = tuple(
                (x_base + sign * splay * fraction, -0.028 - 0.006 * fraction,
                 0.746 - length * fraction)
                for fraction in (0.0, 0.22, 0.43, 0.64, 0.83, 1.0)
            )
            # Slightly fuller proximal phalanges survive the watertight union and
            # better match the gloved reference hand; distal tips stay tapered.
            radius = 0.0084 if finger_index in (1, 2) else 0.0076
            finger_radii = tuple(
                (radius * scale, radius * scale * 0.76)
                for scale in (1.08, 1.03, 0.97, 0.90, 0.80, 0.45)
            )
            builder.add_loft(
                tube_rings(points, finger_radii, sides=16)
            )

        # Opposable thumb, angled away from the palm.
        thumb_x = sign * (hand_x + 0.035)
        thumb_points = (
            (sign * (hand_x + 0.034), -0.024, 0.800),
            (thumb_x + sign * 0.006, -0.029, 0.789),
            (thumb_x + sign * 0.013, -0.034, 0.775),
            (thumb_x + sign * 0.020, -0.038, 0.756),
            (thumb_x + sign * 0.025, -0.040, 0.742),
        )
        builder.add_loft(
            tube_rings(thumb_points, ((0.0115, 0.0102), (0.0110, 0.0097), (0.0102, 0.0090),
                                      (0.0087, 0.0075), (0.0048, 0.0041)), sides=16)
        )


def add_anatomical_masses(builder: SurfaceBuilder) -> None:
    # Deltoids make the chest-clavicle-arm transition anatomical after remeshing.
    for sign in (-1.0, 1.0):
        builder.add_lathe_ellipsoid((sign * 0.184, 0.002, 1.326), (0.043, 0.050, 0.043), 32, 18)

    # Kneecaps/heels are shallow volumes, not visible attached primitive parts after
    # the whole scaffold is remeshed into a single watertight polygon surface.
    for sign in (-1.0, 1.0):
        builder.add_lathe_ellipsoid((sign * 0.138, -0.050, 0.475), (0.037, 0.018, 0.037), 24, 14)


def populate_body(builder: SurfaceBuilder) -> None:
    builder.add_loft(torso_rings())
    add_arms(builder)
    add_legs(builder)
    add_hands(builder)
    add_anatomical_masses(builder)


def object_from_builder(builder: SurfaceBuilder, name: str = "BODY_CONTINUOUS") -> bpy.types.Object:

    mesh = bpy.data.meshes.new(f"{name}_MESH")
    mesh.from_pydata(builder.vertices, [], builder.faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def create_body_scaffold(name: str = "BODY_CONTINUOUS") -> bpy.types.Object:
    builder = SurfaceBuilder()
    populate_body(builder)
    return object_from_builder(builder, name)


def make_watertight(obj: bpy.types.Object, voxel_size: float = 0.0075) -> None:
    """Union the overlapping anatomical lofts into one continuous surface."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.data.remesh_voxel_size = voxel_size
    obj.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()

    sculpt_reference_proportions(obj)

    # Post-remesh anatomical surface pass.  It removes residual voxel plateaus and
    # adds subtle clavicle, knee, calf, ankle and arch curvature without changing
    # connectivity or relying on sculpt-mode operators.
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        ax = abs(x)
        # Collarbone plane falls gently from sternum toward the acromion.
        if 1.33 < z < 1.40 and ax < 0.21:
            falloff = (1.0 - ax / 0.21) * max(0.0, 1.0 - abs(z - 1.365) / 0.035)
            if y < 0.0:
                vertex.co.y += 0.005 * falloff
        # Soft lower abdomen and iliac transition; prevents a flat pelvic facade.
        if 0.86 < z < 1.02 and ax < 0.18 and y < 0.0:
            vertex.co.y -= 0.004 * math.sin(math.pi * (z - 0.86) / 0.16)
        # Kneecap and popliteal relief.
        if 0.43 < z < 0.51 and ax > 0.07:
            knee = max(0.0, 1.0 - abs(z - 0.47) / 0.04)
            vertex.co.y += (-0.004 if y < 0.0 else -0.002) * knee
        # Ankle narrows smoothly below the calf, with a more natural medial line.
        if 0.09 < z < 0.22 and ax > 0.07:
            taper = max(0.0, 1.0 - (z - 0.09) / 0.13)
            vertex.co.x *= 1.0 - 0.025 * taper
        # Lift the midfoot arch while preserving heel and toe contact.
        if -0.19 < y < -0.045 and z < 0.075:
            arch = math.sin(math.pi * (abs(y) - 0.045) / 0.145)
            vertex.co.z += max(0.0, arch) * 0.007

    for polygon in obj.data.polygons:
        polygon.use_smooth = True

    # Voxel union leaves narrow ring-like ridges where dense lofts overlap.  A
    # bounded Laplacian pass removes those seams before the final modifier while
    # preserving silhouette landmarks authored above.
    adjacency: list[list[int]] = [[] for _ in obj.data.vertices]
    for edge in obj.data.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    protected = []
    for vertex in obj.data.vertices:
        x, y, z = vertex.co
        protected.append(
            z < 0.035
            or z > 1.485
            or (z < 0.84 and abs(x) > 0.285)  # fingers and their separation
            or (z < 0.13 and abs(y) > 0.14)   # heel/toe contact landmarks
        )
    for _iteration in range(3):
        previous = [vertex.co.copy() for vertex in obj.data.vertices]
        for index, vertex in enumerate(obj.data.vertices):
            neighbors = adjacency[index]
            if protected[index] or not neighbors:
                continue
            average = sum((previous[neighbor] for neighbor in neighbors), Vector()) / len(neighbors)
            # Keep the vertical landmark almost fixed; smooth mainly across the
            # surface tangent to avoid shrinking the 1.70 m proportions.
            delta = average - previous[index]
            delta.z *= 0.22
            vertex.co = previous[index] + delta * 0.18

    # A global Smooth modifier can close the narrow arm/hip clearance that the
    # scaffold deliberately creates.  The bounded Laplacian pass above already
    # removes voxel stair-stepping while preserving that deformation-safe gap.


def mesh_statistics(obj: bpy.types.Object) -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        triangles = sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
        return {
            "vertices": len(mesh.vertices),
            "edges": len(mesh.edges),
            "faces": len(mesh.polygons),
            "triangles": triangles,
        }
    finally:
        evaluated.to_mesh_clear()
