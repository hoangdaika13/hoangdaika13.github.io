"""Rigging APIs for the procedural Astra H-08 character.

Nothing is built on import.  Pipeline entry points must be called explicitly after
the approved body stage.
"""

from .armature import (
    IK_FK_PROPERTY,
    REQUIRED_CONTROL_BONES,
    REQUIRED_DEFORM_BONES,
    REQUIRED_MECHANISM_BONES,
    RIG_NAME,
    RigBuildError,
    RigValidationError,
    build_humanoid_rig,
    required_bone_names,
    set_ik_fk_blend,
    validate_humanoid_rig,
)
from .facial_rig import (
    FACIAL_SHAPE_KEYS,
    FacialRigError,
    build_facial_rig,
    create_facial_demo_action,
    validate_facial_shape_keys,
)
from .hair_rig import (
    HAIR_BONES,
    HAIR_CHAINS,
    HairRigError,
    build_hair_rig,
    validate_hair_rig,
)
from .weights import WeightingError, bind_meshes_to_rig

__all__ = (
    "IK_FK_PROPERTY",
    "REQUIRED_CONTROL_BONES",
    "REQUIRED_DEFORM_BONES",
    "REQUIRED_MECHANISM_BONES",
    "RIG_NAME",
    "RigBuildError",
    "RigValidationError",
    "build_humanoid_rig",
    "required_bone_names",
    "set_ik_fk_blend",
    "validate_humanoid_rig",
    "FACIAL_SHAPE_KEYS",
    "FacialRigError",
    "build_facial_rig",
    "create_facial_demo_action",
    "validate_facial_shape_keys",
    "HAIR_BONES",
    "HAIR_CHAINS",
    "HairRigError",
    "build_hair_rig",
    "validate_hair_rig",
    "WeightingError",
    "bind_meshes_to_rig",
)
