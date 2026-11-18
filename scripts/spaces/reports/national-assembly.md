# national-assembly asset pipeline

Source: C:\Users\choon\AppData\Local\Temp\claude\b2fe57d31c28208d\cd5ead51-17ef-43b7-b1a7-28f1198506f8\scratchpad\na-source
Output: C:\WORK\TwinverseAI\.claude\worktrees\websocket-routes-404-b33082\frontend\src\spaces\national-assembly\assets
Run: 2026-11-18T12:08:46.911Z (28 s)

Sizes in MB. Geometry = non-image bytes stored in the GLB (data-less meshopt fallback views are not counted). GPU textures = as uploaded (plain images: RGBA8 with mips; KTX2: BC7 / ASTC 4x4 with its mips).

| file | size before | size after | images | geometry before | geometry after | GPU textures before | GPU textures after | triangles |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| avatar.glb | 6.62 | 0.33 | 5.03 -> 3.29 | 1.56 | 0.27 | 37.10 | 9.28 | 19,732 -> 19,732 |
| national-assembly.glb | 40.86 | 6.58 | 19.02 -> 40.83 | 21.74 | 6.38 | 622.24 | 152.89 | 353,449 -> 353,449 |
| scenery-gate-1.glb | 41.43 | 11.10 | 28.37 -> 108.15 | 12.98 | 11.02 | 1464.00 | 362.88 | 819,586 -> 819,586 |
| scenery-gate-2.glb | 39.56 | 2.37 | 37.21 -> 25.04 | 2.32 | 2.33 | 688.00 | 164.00 | 355,683 -> 355,683 |
| scenery-heritage.glb | 26.42 | 3.06 | 14.47 -> 25.05 | 11.95 | 3.05 | 384.00 | 81.00 | 487,469 -> 487,469 |
| vegetation-1.glb | 18.11 | 4.38 | 3.45 -> 2.97 | 14.63 | 4.33 | 157.33 | 20.08 | 401,090 -> 401,090 |
| vegetation-2.glb | 19.48 | 5.28 | 2.74 -> 3.17 | 16.72 | 5.25 | 200.00 | 23.00 | 324,045 -> 324,045 |
| vegetation-3.glb | 15.33 | 4.50 | 2.28 -> 1.61 | 13.01 | 4.43 | 173.33 | 13.83 | 212,709 -> 212,709 |
| vegetation-4.glb | 5.37 | 0.88 | 2.46 -> 2.93 | 2.88 | 0.83 | 165.33 | 22.33 | 109,316 -> 109,316 |
| **total** | 213.19 | 38.48 | 115.02 -> 213.03 | 97.79 | 37.89 | 3891.34 | 849.30 | 3,083,079 -> 3,083,079 |

Precision (decoded and checked per accessor):
- avatar.glb (avatar): position EXPONENTIAL+NONE 13-16 bits max error 0.031 mm; normal OCTAHEDRAL+NONE 10-10 bits max error 0.0038 ; tangent OCTAHEDRAL 10-10 bits max error 0.0038 ; texcoord EXPONENTIAL 15-15 bits max error 0.0 uv; names kept: 0 prefixed, 0 from manifests
- national-assembly.glb (architecture): position EXPONENTIAL 16-24 bits max error 0.12 mm; normal OCTAHEDRAL 10-10 bits max error 0.0037 ; texcoord EXPONENTIAL 15-23 bits max error 0.000031 uv; color EXPONENTIAL 13-14 bits max error 0.00012 ; names kept: 99 prefixed, 0 from manifests
- scenery-gate-1.glb (gate): position NONE max error 0.0 mm; normal OCTAHEDRAL 8-8 bits max error 0.0099 ; tangent OCTAHEDRAL 8-8 bits max error 0.0099 ; texcoord NONE+EXPONENTIAL 15-22 bits max error 0.000031 uv; names kept: 14 prefixed, 6 from manifests
- scenery-gate-2.glb (gate): position NONE max error 0.0 mm; normal OCTAHEDRAL 8-8 bits max error 0.0099 ; tangent OCTAHEDRAL 8-8 bits max error 0.0099 ; texcoord NONE max error 0.0 uv; names kept: 0 prefixed, 0 from manifests
- scenery-heritage.glb (architecture): position EXPONENTIAL 10-19 bits max error 0.12 mm; normal OCTAHEDRAL 10-10 bits max error 0.0041 ; texcoord EXPONENTIAL 15-15 bits max error 0.000031 uv; names kept: 0 prefixed, 0 from manifests
- vegetation-1.glb (vegetation): position EXPONENTIAL 14-18 bits max error 0.12 mm; normal OCTAHEDRAL 8-8 bits max error 0.021 ; texcoord EXPONENTIAL 15-18 bits max error 0.000031 uv; names kept: 12 prefixed, 12 from manifests
- vegetation-2.glb (vegetation): position EXPONENTIAL 16-18 bits max error 0.12 mm; normal OCTAHEDRAL 8-8 bits max error 0.021 ; texcoord EXPONENTIAL 15-16 bits max error 0.000031 uv; names kept: 8 prefixed, 8 from manifests
- vegetation-3.glb (vegetation): position EXPONENTIAL 12-16 bits max error 0.12 mm; normal OCTAHEDRAL 8-8 bits max error 0.022 ; texcoord EXPONENTIAL 15-16 bits max error 0.000031 uv; names kept: 30 prefixed, 30 from manifests
- vegetation-4.glb (vegetation): position EXPONENTIAL 13-15 bits max error 0.12 mm; normal OCTAHEDRAL 8-8 bits max error 0.019 ; texcoord EXPONENTIAL 15-16 bits max error 0.000031 uv; names kept: 15 prefixed, 15 from manifests


Download at full resolution: 38.48 MB GLBs + 213.03 MB in 252 texture files = 251.51 MB; largest file 18.20 MB (limit 45.00 MB).

Textures (KTX2, transcoded on the GPU to BC7 on desktop / ASTC 4x4 elsewhere, 1 byte per texel plus mips):
- blend -> etc1s-255: 1 textures, 0.29 MB source -> 0.16 MB KTX2, 1.33 MB on the GPU
- colour -> etc1s-128: 15 textures, 3.23 MB source -> 4.29 MB KTX2, 51.06 MB on the GPU
- colour -> etc1s-255: 34 textures, 29.33 MB source -> 22.39 MB KTX2, 144.02 MB on the GPU, 28 met no threshold
- hero -> uastc-rdo1: 9 textures, 12.76 MB source -> 52.06 MB KTX2, 64.00 MB on the GPU
- hero -> uastc-rdo2: 11 textures, 9.39 MB source -> 39.07 MB KTX2, 58.67 MB on the GPU
- hero -> uastc-rdo4: 13 textures, 3.94 MB source -> 12.39 MB KTX2, 44.36 MB on the GPU
- heroBlend -> uastc-rdo4: 1 textures, 0.01 MB source -> 0.01 MB KTX2, 0.33 MB on the GPU
- heroNormal -> uastc-rdo1: 4 textures, 3.17 MB source -> 12.81 MB KTX2, 16.08 MB on the GPU
- heroNormal -> uastc-rdo2: 3 textures, 2.14 MB source -> 1.65 MB KTX2, 3.00 MB on the GPU
- heroNormal -> uastc-rdo4: 21 textures, 4.01 MB source -> 30.50 MB KTX2, 123.00 MB on the GPU
- mask -> etc1s-255: 18 textures, 2.18 MB source -> 1.59 MB KTX2, 9.42 MB on the GPU, 10 met no threshold
- normal -> etc1s-normal: 64 textures, 28.55 MB source -> 22.36 MB KTX2, 176.94 MB on the GPU, 34 met no threshold
- orm -> etc1s-128: 28 textures, 1.99 MB source -> 3.06 MB KTX2, 80.58 MB on the GPU
- orm -> etc1s-255: 30 textures, 14.00 MB source -> 10.70 MB KTX2, 76.50 MB on the GPU, 25 met no threshold

Right-sized to the density caps (52): texture, from -> to, texels per metre at full size (near / far / distant):
- avatar.glb baseColor1: 2x2 -> 4x4 (- / - / -)
- national-assembly.glb derived_flag_taegukgi: 2049x1366 -> 1024x684 (- / - / 455)
- scenery-gate-1.glb MI_GHM_1F_Top01A_BaseColor: 512x512 -> 128x128 (- / 1043 / -)
- scenery-gate-1.glb MI_GHM_1F_Top01A_Normal: 512x512 -> 128x128 (- / 1043 / -)
- scenery-gate-1.glb MI_GHM_T0301A_BaseColor: 1024x1024 -> 256x256 (- / 1217 / 1217)
- scenery-gate-1.glb MI_GHM_T0301A_Normal: 1024x1024 -> 256x256 (- / 1217 / 1217)
- scenery-gate-2.glb MI_GHM_Stairdecoration_BaseColor: 2048x2048 -> 1024x1024 (1120 / - / -)
- scenery-gate-2.glb MI_GHM_Stairdecoration_Normal: 2048x2048 -> 1024x1024 (1120 / - / -)
- scenery-heritage.glb T_027_Sundial_AO-T_027_Sundial_MR: 2048x2048 -> 512x512 (2834 / - / -)
- scenery-heritage.glb T_027_Sundial_BC: 2048x2048 -> 512x512 (2834 / - / -)
- scenery-heritage.glb T_027_Sundial_N: 2048x2048 -> 512x512 (2834 / - / -)
- vegetation-1.glb impostor_ConiferShrub_col: 512x512 -> 256x256 (- / - / 268)
- vegetation-1.glb impostor_ConiferShrub_nor: 512x512 -> 256x256 (- / - / 268)
- vegetation-1.glb pine_sapling_small_twig_diff-pine_sapling_small_twig_alpha: 1024x1024 -> 512x512 (1433 / - / 935)
- vegetation-1.glb pine_sapling_small_twig_nor_gl_1024: 1024x1024 -> 512x512 (1433 / - / 935)
- vegetation-1.glb pine_sapling_small_twig_rough_1024: 1024x1024 -> 512x512 (1433 / - / 935)
- vegetation-1.glb pine_tree_01_bark_diff_1024: 1024x1024 -> 256x256 (2814 / - / 1189)
- vegetation-1.glb pine_tree_01_bark_nor_gl_1024: 1024x1024 -> 256x256 (2814 / - / 1189)
- vegetation-1.glb pine_tree_01_bark_rough_1024: 1024x1024 -> 256x256 (2814 / - / 1189)
- vegetation-1.glb pine_tree_01_twig_diff-pine_tree_01_twig_alpha: 2048x2048 -> 1024x1024 (1460 / - / 1633)
- vegetation-1.glb pine_tree_01_twig_nor_gl_2k: 2048x2048 -> 1024x1024 (1460 / - / 1633)
- vegetation-1.glb pine_tree_01_twig_rough_2k: 2048x2048 -> 1024x1024 (1460 / - / 1633)
- vegetation-2.glb island_tree_02_leaves_diff-island_tree_02_leaves_alpha: 2048x2048 -> 512x512 (3631 / - / 3454)
- vegetation-2.glb island_tree_02_leaves_nor_gl_2k: 2048x2048 -> 512x512 (3631 / - / 3454)
- vegetation-2.glb island_tree_02_leaves_rough_2k: 2048x2048 -> 512x512 (3631 / - / 3454)
- vegetation-2.glb tree_small_02_leaves_diff-tree_small_02_leaves_alpha: 2048x2048 -> 1024x1024 (1717 / - / 1039)
- vegetation-2.glb tree_small_02_leaves_nor_gl_2k: 2048x2048 -> 1024x1024 (1717 / - / 1039)
- vegetation-2.glb tree_small_02_leaves_rough_2k: 2048x2048 -> 1024x1024 (1717 / - / 1039)
- vegetation-3.glb fern_02_diff-fern_02_alpha: 1024x1024 -> 512x512 (1143 / - / 553)
- vegetation-3.glb fern_02_nor_gl_1024: 1024x1024 -> 512x512 (1143 / - / 553)
- vegetation-3.glb fern_02_rough_1024: 1024x1024 -> 512x512 (1143 / - / 553)
- vegetation-3.glb flower_heliophila_diff-flower_heliophila_alpha: 1024x1024 -> 256x256 (2665 / - / 1464)
- vegetation-3.glb flower_heliophila_nor_gl_1024: 1024x1024 -> 256x256 (2665 / - / 1464)
- vegetation-3.glb flower_heliophila_rough_1024: 1024x1024 -> 256x256 (2665 / - / 1464)
- vegetation-3.glb flower_ursinia_diff-flower_ursinia_alpha: 1024x1024 -> 256x256 (2592 / - / 1259)
- vegetation-3.glb flower_ursinia_nor_gl_1024: 1024x1024 -> 256x256 (2592 / - / 1259)
- vegetation-3.glb flower_ursinia_rough_1024: 1024x1024 -> 256x256 (2592 / - / 1259)
- vegetation-3.glb grass_medium_02_diff-grass_medium_02_alpha: 1024x1024 -> 512x512 (1745 / - / 830)
- vegetation-3.glb grass_medium_02_nor_gl_1024: 1024x1024 -> 512x512 (1745 / - / 830)
- vegetation-3.glb grass_medium_02_rough_1024: 1024x1024 -> 512x512 (1745 / - / 830)
- vegetation-3.glb impostor_HedgeTall_col: 512x1024 -> 256x512 (- / - / 241)
- vegetation-3.glb impostor_HedgeTall_nor: 512x1024 -> 256x512 (- / - / 241)
- vegetation-3.glb searsia_burchellii_diff-searsia_burchellii_alpha: 2048x2048 -> 512x512 (2605 / - / 1536)
- vegetation-3.glb searsia_burchellii_nor_gl: 2048x2048 -> 512x512 (2605 / - / 1536)
- vegetation-3.glb searsia_burchellii_rough: 2048x2048 -> 512x512 (2605 / - / 1536)
- vegetation-4.glb modular_street_seating_armrests_diff_1024: 1024x1024 -> 512x512 (960 / - / 888)
- vegetation-4.glb modular_street_seating_armrests_metal-modular_street_seating_armrests_rough: 1024x1024 -> 512x512 (960 / - / 888)
- vegetation-4.glb modular_street_seating_armrests_nor_gl_1024: 1024x1024 -> 512x512 (960 / - / 888)
- vegetation-4.glb street_lamp_01_diff_2k: 2048x2048 -> 1024x1024 (994 / - / 960)
- vegetation-4.glb street_lamp_01_diff-street_lamp_01_opacity: 2048x2048 -> 1024x1024 (994 / - / 994)
- vegetation-4.glb street_lamp_01_metal-street_lamp_01_rough: 2048x2048 -> 1024x1024 (994 / - / 970)
- vegetation-4.glb street_lamp_01_nor_gl: 2048x2048 -> 1024x1024 (994 / - / 970)

Kept at full size by rule (47): concrete_tiles_02_ao_2k-concrete_tiles_02_rough_2k (tiling (texture coordinates span 157.4)); concrete_tiles_02_diff_2k (tiling (texture coordinates span 157.4)); derived_concrete_tiles_02_nor_gl_1k (tiling (texture coordinates span 157.4)); derived_copper_patina_diff_2k (tiling (texture coordinates span 17.6)); derived_copper_patina_rough_2k (tiling (texture coordinates span 17.6)); derived_corrugated_iron_02_nor_gl_2k (tiling (texture coordinates span 17.6)); derived_farm_soil_nor_gl_1k (tiling (texture coordinates span 302.3)); derived_granite_ashlar_diff_2k (tiling (texture coordinates span 187.9)); derived_granite_dark_diff_2k (tiling (texture coordinates span 450.0)); derived_granite_paving_diff_2k (tiling (texture coordinates span 359.9)); derived_granite_wall_nor_gl_1k (tiling (texture coordinates span 187.9)); derived_lawn_diff_2k (tiling (texture coordinates span 23.3)); derived_leafy_grass_nor_gl_1k (tiling (texture coordinates span 23.3)); derived_woodland_diff_1k (tiling (texture coordinates span 360.0)); farm_soil_ao_2k-farm_soil_rough_2k (tiling (texture coordinates span 302.3)); farm_soil_diff_2k (tiling (texture coordinates span 302.3)); forrest_ground_01_ao_1k-forrest_ground_01_rough_1k (tiling (texture coordinates span 360.0)); forrest_ground_01_nor_gl_1k (tiling (texture coordinates span 360.0)); granite_wall_rough_2k (tiling (texture coordinates span 187.9)); gravel_floor_02_ao_1k-gravel_floor_02_rough_1k (tiling (texture coordinates span 218.1)); gravel_floor_02_diff_1k (tiling (texture coordinates span 218.1)); gravel_floor_02_nor_gl_1k (tiling (texture coordinates span 218.1)); leafy_grass_ao_2k-leafy_grass_rough_2k (tiling (texture coordinates span 23.3)); MI_GHM_Pole01A_BaseColor (tiling (texture coordinates span 21.4)); MI_GHM_Pole01A_Normal (tiling (texture coordinates span 21.4)); MI_GHM_Stone01A_BaseColor (tiling (texture coordinates span 2.4)); MI_GHM_Stone01A_Normal (tiling (texture coordinates span 2.4)); MI_GHM_Top01A_BaseColor (tiling (texture coordinates span 8.2)); MI_GHM_Top01A_Normal (tiling (texture coordinates span 8.2)); MI_GHM_Top02A_BaseColor (tiling (texture coordinates span 2.3)); MI_GHM_Top02A_Normal (tiling (texture coordinates span 2.3)); MI_GHM_Ws02A_BaseColor (tiling (texture coordinates span 6.7)); MI_GHM_Ws02A_Normal (tiling (texture coordinates span 6.7)); MI_GHM_Ws03A_BaseColor (tiling (texture coordinates span 2.6)); MI_GHM_Ws03A_Normal (tiling (texture coordinates span 2.6)); pine_sapling_small_bark_diff_1024 (tiling (texture coordinates span 3.5)); pine_sapling_small_bark_nor_gl_1024 (tiling (texture coordinates span 3.5)); pine_sapling_small_bark_rough_1024 (tiling (texture coordinates span 3.5)); pine_tree_01_trunk_b_diff_1024 (tiling (texture coordinates span 5.0)); pine_tree_01_trunk_b_nor_gl_1024 (tiling (texture coordinates span 5.0)); pine_tree_01_trunk_b_rough_1024 (tiling (texture coordinates span 5.0)); tree_small_02_branch_diff_1024 (no measurable use); tree_small_02_branch_nor_gl_1024 (no measurable use); tree_small_02_branch_rough_1024 (no measurable use); periwinkle_plant_diff-periwinkle_plant_opacity (tiling (texture coordinates span 2.9)); periwinkle_plant_nor_gl_1024 (tiling (texture coordinates span 2.9)); periwinkle_plant_rough_1024 (tiling (texture coordinates span 2.9))

Hero textures (73): baseColor 64 uastc-rdo4 0.00 MB; baseColor1 4 uastc-rdo4 0.00 MB; baseColor12 1024 uastc-rdo4 0.28 MB; glasses-52-D 512 uastc-rdo4 0.01 MB; glasses-52-M-glasses-52-R 256 etc1s-255 0.00 MB; headwear-baseball-01-D 1024 uastc-rdo4 0.71 MB; headwear-baseball-01-N 1024 uastc-rdo2 0.83 MB; headwear-baseball-01-R 512 etc1s-128 0.02 MB; jacket-sport-01-pastelgreen-C 1024 uastc-rdo4 0.64 MB; jacket-sport-01-pastelgreen-M-jacket-sport-01-pastelgreen-R 512 etc1s-255 0.03 MB; jacket-sport-01-pastelgreen-N 512 uastc-rdo2 0.21 MB; pants-casual-01-black-C 1024 uastc-rdo4 0.13 MB; pants-casual-01-N 512 uastc-rdo4 0.16 MB; pants-casual-01-R 512 etc1s-128 0.02 MB; tennis-casual-02_blue-C 512 uastc-rdo4 0.16 MB; tennis-casual-02-M-tennis-casual-02-R 256 etc1s-255 0.01 MB; tennis-casual-02-N 256 uastc-rdo1 0.06 MB; Wolf3D_Teeth 128 uastc-rdo4 0.01 MB; derived_building_ao_4k 4096 etc1s-128 1.06 MB; derived_granite_facade_diff_4k 4096 uastc-rdo1 18.20 MB; derived_granite_facade_rough_2k 2048 etc1s-128 0.09 MB; derived_granite_podium_diff_2k 2048 uastc-rdo2 4.79 MB; derived_granite_tile_03_nor_gl_2k 2048 uastc-rdo4 2.63 MB; granite_tile_04_nor_gl_2k 2048 uastc-rdo4 2.16 MB; granite_tile_04_rough_2k 2048 etc1s-255 0.79 MB; MI_GHM_1F_Wood_BaseColor 2048 uastc-rdo4 2.79 MB; MI_GHM_1F_Wood_Normal 2048 uastc-rdo4 2.31 MB; MI_GHM_3D01A_BaseColor 2048 uastc-rdo1 4.71 MB; MI_GHM_3D01A_Normal 2048 uastc-rdo4 1.89 MB; MI_GHM_3D02A_BaseColor 2048 uastc-rdo1 4.59 MB; MI_GHM_3D02A_Normal 2048 uastc-rdo4 1.54 MB; MI_GHM_Fw01A_BaseColor 1024 uastc-rdo4 0.33 MB; MI_GHM_Fw01A_Normal 1024 uastc-rdo2 0.60 MB; MI_GHM_Gate01A_BaseColor 2048 uastc-rdo2 3.64 MB; MI_GHM_Gate01A_Normal 2048 uastc-rdo4 1.07 MB; MI_GHM_Gate02A_BaseColor 2048 uastc-rdo4 2.77 MB; MI_GHM_Gate02A_Normal 2048 uastc-rdo4 1.03 MB; MI_GHM_Gate03A_BaseColor 2048 uastc-rdo1 4.53 MB; MI_GHM_Gate03A_Normal 2048 uastc-rdo4 1.74 MB; MI_GHM_Gate04A_BaseColor 2048 uastc-rdo2 4.04 MB; MI_GHM_Gate04A_Normal 2048 uastc-rdo4 1.71 MB; MI_GHM_Gp01A_BaseColor 2048 uastc-rdo2 4.01 MB; MI_GHM_Gp01A_Normal 2048 uastc-rdo4 1.59 MB; MI_GHM_Gst01A_BaseColor 2048 uastc-rdo1 4.98 MB; MI_GHM_Gst01A_Normal 2048 uastc-rdo1 4.24 MB; MI_GHM_Gw01A_BaseColor 2048 uastc-rdo2 3.77 MB; MI_GHM_Gw01A_Normal 2048 uastc-rdo4 0.76 MB; MI_GHM_Gw02A_BaseColor 2048 uastc-rdo2 2.48 MB; MI_GHM_Gw02A_Normal 2048 uastc-rdo4 1.06 MB; MI_GHM_HangingBoard_BaseColor 4096 uastc-rdo4 2.45 MB; MI_GHM_HangingBoard_MetallicRoughness 4096 etc1s-128 0.13 MB; MI_GHM_HangingBoard_Normal 4096 uastc-rdo4 1.79 MB; MI_GHM_Mark01A_BaseColor 2048 uastc-rdo1 2.46 MB; MI_GHM_Mark01A_Normal 2048 uastc-rdo4 1.19 MB; MI_GHM_Symbol01A_BaseColor 2048 uastc-rdo2 2.54 MB; MI_GHM_Symbol01A_Normal 2048 uastc-rdo4 2.09 MB; MI_GHM_Symbol02A_BaseColor 2048 uastc-rdo4 2.11 MB; MI_GHM_Symbol02A_Normal 2048 uastc-rdo4 0.85 MB; MI_GHM_Symbol03A_BaseColor 2048 uastc-rdo2 2.71 MB; MI_GHM_Symbol03A_Normal 2048 uastc-rdo4 0.74 MB; MI_GHM_Symbol04A_BaseColor 2048 uastc-rdo2 2.22 MB; MI_GHM_W01A_BaseColor 2048 uastc-rdo1 4.76 MB; MI_GHM_W01A_Normal 2048 uastc-rdo4 1.70 MB; MI_GHM_Wb01A_BaseColor 2048 uastc-rdo1 3.73 MB; MI_GHM_Wb01A_Normal 2048 uastc-rdo4 0.57 MB; MI_GHM_Ws01A_BaseColor 2048 uastc-rdo1 4.09 MB; MI_GHM_Ws01A_Normal 2048 uastc-rdo4 1.94 MB; MI_GHM_HaetaeA_BaseColor 2048 uastc-rdo2 4.40 MB; MI_GHM_HaetaeA_MetallicRoughness 2048 etc1s-255 0.69 MB; MI_GHM_HaetaeA_Normal 2048 uastc-rdo1 4.18 MB; MI_GHM_HaetaeB_BaseColor 2048 uastc-rdo2 4.47 MB; MI_GHM_HaetaeB_MetallicRoughness 2048 etc1s-255 0.58 MB; MI_GHM_HaetaeB_Normal 2048 uastc-rdo1 4.33 MB

UASTC overrides: none

Viewer check:
- KTX2 textures: 252 transcode to BC7 with three.js's transcoder (first and last mip)
- collision probes: 11/11 hit
- door leaves: 6/6 found with their pivots
- world bounds of every named node: largest change 0.122 mm (national-assembly.glb:Bed_Woodland_09)
- static merge (meshes before -> after merging): avatar.glb 9->9, national-assembly.glb 125->100, scenery-gate-1.glb 39->38, scenery-gate-2.glb 16->13, scenery-heritage.glb 6->6, vegetation-1.glb 0->0, vegetation-2.glb 0->0, vegetation-3.glb 0->0, vegetation-4.glb 0->0
- vegetation levels: 65 found, largest bounds change 0.122 mm

SHA-256:
- avatar.glb 71bfa69bbe73c79bcc5fe3773d9199095f5ac813c5534db962390c951befe1e9
- national-assembly.glb d84f674177ca94076929b40cd6c964bfa68ed561d717b81badfe745ec3e1648d
- scenery-gate-1.glb 8643b4d1e919b803c8de995e4d84fb9dff65a424d4082747cfb780b7503765f6
- scenery-gate-2.glb b0f72d601740a4451f065c041250a86ffe728f5826efa3436ebe8524ff79fb5d
- scenery-heritage.glb 9085161dd4e5cf5eeb52ce83f1238fe145174af6831d539ce6160926018b0475
- vegetation-1.glb 5a4a4645879321f8c9b46a319b33cc2b2df355284af6d9f892fa060c127df24b
- vegetation-2.glb 0671f79534c4d398eddcf3df78129483b8ca00b654721aee9ea78f58486fccbf
- vegetation-3.glb 8d0cae106905c8d4bcb8e5ccdbb2dafeab97756c80054d6b39c4ec2a2a6745a8
- vegetation-4.glb 8c5a918cc0363f34a2224bfff4c66a9637265d6c3a5442e094093149db4134c8
