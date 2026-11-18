#!/usr/bin/env python3
"""Pack a compact multi-biome LimeZu 32x32 atlas + animated character strip for
the Oikos Desktop plugin from your own purchased LimeZu packs.

The outputs are the private build inputs for the art bundle. They are gitignored and must not be
committed or shared as files; see THIRD_PARTY_NOTICES.md.
"""

import io
import json
import os
import sys
import zipfile
from PIL import Image


class ShelfPacker:
    def __init__(self, width=1024, pad=2):
        self.width = width
        self.pad = pad
        self.x = pad
        self.y = pad
        self.row_h = 0
        self.items = []

    def add(self, key, im):
        im = im.convert("RGBA")
        w, h = im.size
        if self.x + w + self.pad > self.width:
            self.x = self.pad
            self.y += self.row_h + self.pad
            self.row_h = 0
        px, py = self.x, self.y
        self.items.append((key, im, px, py, w, h))
        self.x += w + self.pad
        if h > self.row_h:
            self.row_h = h
        return {"x": px, "y": py, "w": w, "h": h}

    def build(self, out_path):
        total_h = max(32, self.y + self.row_h + self.pad)
        canvas = Image.new("RGBA", (self.width, total_h), (0, 0, 0, 0))
        rects = {}
        for key, im, px, py, w, h in self.items:
            canvas.paste(im, (px, py))
            rects[key] = {"x": px, "y": py, "w": w, "h": h}
        canvas.save(out_path, optimize=True)
        return rects, [self.width, total_h]


def load_zip_img(z, path):
    return Image.open(io.BytesIO(z.read(path))).convert("RGBA")


def main():
    # Inputs: your own purchased LimeZu downloads (OIKOS_PACKS_DIR, default ~/Downloads).
    # Output: --out DIR (default src/assets, which is gitignored for *.png and embedded_data.limezu.js).
    packs_dir = os.path.expanduser(os.environ.get("OIKOS_PACKS_DIR", "~/Downloads"))
    me_path = os.path.join(packs_dir, "modernexteriors-win.zip")
    mi_path = os.path.join(packs_dir, "moderninteriors-win.zip")
    cg_path = os.path.join(packs_dir, "Character Generator 2.0 Linux Build.zip")
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "assets"))
    if "--out" in sys.argv:
        out_dir = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])
    os.makedirs(out_dir, exist_ok=True)

    packer = ShelfPacker(width=1024, pad=2)
    me_base = "Modern_Exteriors_32x32/ME_Theme_Sorter_32x32"

    with zipfile.ZipFile(me_path) as me_zip, \
         zipfile.ZipFile(mi_path) as mi_zip:

        me_names = set(me_zip.namelist())
        mi_names = set(mi_zip.namelist())

        def add_me(key, rel_path, max_dim=None, trim=False):
            full = f"{me_base}/{rel_path}"
            if full not in me_names:
                raise FileNotFoundError(f"Missing ME: {full}")
            im = load_zip_img(me_zip, full)
            if trim and im.getbbox():
                im = im.crop(im.getbbox())
            if max_dim and (im.width > max_dim or im.height > max_dim):
                scale = min(max_dim / im.width, max_dim / im.height)
                im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.NEAREST)
            packer.add(key, im)

        def add_modular_building(key, roof_rel, ground_rel):
            roof_im = load_zip_img(me_zip, f"{me_base}/{roof_rel}")
            ground_im = load_zip_img(me_zip, f"{me_base}/{ground_rel}")
            w = max(roof_im.width, ground_im.width)
            h = max(32, roof_im.height + ground_im.height - 32)
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            canvas.paste(roof_im, (0, 0), roof_im)
            canvas.paste(ground_im, (0, max(0, roof_im.height - 32)), ground_im)
            if canvas.getbbox():
                canvas = canvas.crop(canvas.getbbox())
            packer.add(key, canvas)

        # Native 32x32 ground tiles (Core + Expansions)
        grass_base = load_zip_img(me_zip, f"{me_base}/1_Terrains_and_Fences_Singles_32x32/ME_Singles_Terrains_and_Fences_32x32_Grass_1_9.png")
        packer.add("tile_grass", grass_base)
        add_me("tile_grass_2", "1_Terrains_and_Fences_Singles_32x32/ME_Singles_Terrains_and_Fences_32x32_Grass_1_10.png")
        for idx in (1, 2):
            ov = load_zip_img(me_zip, f"{me_base}/1_Terrains_and_Fences_Singles_32x32/ME_Singles_Terrains_and_Fences_32x32_Props_Grass_{idx}.png")
            comp = grass_base.copy()
            comp.paste(ov, (0, 0), ov)
            packer.add(f"grass_flower_{idx}", comp)
        add_me("tile_asphalt", "2_City_Terrains_Singles_32x32/ME_Singles_City_Terrains_32x32_Asphalt_1_Variation_16.png")
        add_me("tile_sidewalk", "2_City_Terrains_Singles_32x32/ME_Singles_City_Terrains_32x32_Sidewalk_1_9.png")
        add_me("tile_water", "1_Terrains_and_Fences_Singles_32x32/ME_Singles_Terrains_and_Fences_32x32_Deep_Water_1_9.png")
        add_me("tile_fence", "1_Terrains_and_Fences_Singles_32x32/ME_Singles_Terrains_and_Fences_32x32_Fence_1_1.png")
        add_me("flowerbed", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Flower_Bush_1.png")

        # Complete multi-story modular buildings (roof + ground composited)
        add_modular_building(
            "midtown_cafe",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Roof_1.png",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Ground_Floor_Bakery_1.png",
        )
        add_modular_building(
            "midtown_condo",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Roof_3.png",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Ground_Floor_Condo_2.png",
        )
        add_modular_building(
            "metro_music",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Roof_2.png",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Ground_Floor_Music_Store_1.png",
        )
        add_modular_building(
            "bldg_ice_cream",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Roof_4.png",
            "5_Floor_Modular_Building_Singles_32x32/ME_Singles_Floor_Modular_Building_32x32_Ground_Floor_Ice_Cream_Shop_1.png",
        )

        # Standalone complete LimeZu buildings
        add_me("bldg_condo_brick", "4_Generic_Building_Singles_32x32/ME_Singles_Generic_Building_32x32_Condo_3_44.png", trim=True)
        add_me("bldg_condo_tall", "4_Generic_Building_Singles_32x32/ME_Singles_Generic_Building_32x32_Condo_4_3.png", max_dim=240, trim=True)
        add_me("bldg_hardware", "4_Generic_Building_Singles_32x32/ME_Singles_Generic_Building_32x32_Hardware_Store_Example.png", max_dim=240, trim=True)
        add_me("bldg_market_1", "9_Shopping_Center_and_Markets_Singles_32x32/ME_Singles_Shopping_Center_and_Markets_32x32_Market_Medium_1.png", max_dim=240, trim=True)
        add_me("bldg_market_2", "9_Shopping_Center_and_Markets_Singles_32x32/ME_Singles_Shopping_Center_and_Markets_32x32_Market_Medium_2.png", max_dim=240, trim=True)
        add_me("bldg_villa_1", "7_Villas_Singles_32x32/ME_Singles_Villas_32x32_Villa_1.png", max_dim=240, trim=True)
        add_me("bldg_villa_2", "7_Villas_Singles_32x32/ME_Singles_Villas_32x32_Villa_2.png", max_dim=240, trim=True)
        add_me("bldg_greenhouse", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Large_Greenhouse_Example.png", max_dim=240, trim=True)
        add_me("bldg_post_office", "22_Post_Office_Singles_32x32/22_Post_Office_32x32_Building_1.png", max_dim=240, trim=True)
        add_me("bldg_beach_stage", "21_Beach_Singles_32x32/21_Beach_32x32_Example_Small_Stage_1.png", max_dim=240, trim=True)
        add_me("bldg_camper", "11_Camping_Singles_32x32/ME_Singles_Camping_32x32_Mobile_House_Medium_1.png", max_dim=224, trim=True)

        # Landmarks, Trees, Street Furniture & Vehicles
        add_me("midtown_lamp", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Street_Lamp_5.png", trim=True)
        add_me("lamp_modern", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Street_Lamp_1.png", trim=True)
        add_me("conservatory_fountain", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Fountain_2_1.png", trim=True)
        add_me("fountain_grand", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Fountain_3_1.png", trim=True)
        add_me("conservatory_tree", "7_Villas_Singles_32x32/ME_Singles_Villas_32x32_Tree_1.png", trim=True)
        add_me("tree_sycamore_2", "7_Villas_Singles_32x32/ME_Singles_Villas_32x32_Tree_2.png", trim=True)
        add_me("street_tree", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Tree_1.png", trim=True)
        add_me("street_tree_2", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Tree_2.png", trim=True)
        add_me("kyoto_house", "24_Additional_Houses_Singles_32x32/24_Additional_Houses_Japanese_House_32x32.png", max_dim=224, trim=True)
        add_me("woodland_cabin", "24_Additional_Houses_Singles_32x32/24_Additional_Houses_Country_House_32x32.png", max_dim=224, trim=True)
        add_me("woodland_tree", "11_Camping_Singles_32x32/ME_Singles_Camping_32x32_Tree_1.png", trim=True)
        add_me("woodland_campfire", "11_Camping_Singles_32x32/ME_Singles_Camping_32x32_Campfire_1.png", trim=True)
        add_me("woodland_tent", "11_Camping_Singles_32x32/ME_Singles_Camping_32x32_Tent_1.png", trim=True)

        add_me("coastal_palm", "21_Beach_Singles_32x32/21_Beach_32x32_Palm_Tree.png", trim=True)
        add_me("coastal_bar", "21_Beach_Singles_32x32/21_Beach_32x32_Bamboo_Bar_Counter_1.png", trim=True)
        add_me("coastal_umbrella", "21_Beach_Singles_32x32/21_Beach_32x32_Blue_Beach_Umbrella_Opened.png", trim=True)
        add_me("studio_office", "16_Office_Singles_32x32/ME_Singles_Office_32x32_Balcony_1_Building_1.png")
        add_me("rittenhouse_statue", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Angel_Statue_1.png", trim=True)
        add_me("statue_goat", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Grass_Statue_7.png", trim=True)
        add_me("bus_septa", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Bus_Right_4.png", trim=True)
        add_me("bus_stop", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Bus_Stop_1.png", trim=True)
        add_me("car_blue", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Right_1.png", trim=True)
        add_me("car_red", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Right_4.png", trim=True)
        add_me("car_green", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Left_10.png", trim=True)
        add_me("car_taxi", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Left_11.png", trim=True)
        add_me("bus_septa_left", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Bus_Left_4.png", trim=True)
        add_me("bus_septa_up", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Bus_Up_4.png", trim=True)
        add_me("bus_septa_down", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Bus_Down_4.png", trim=True)
        add_me("car_blue_left", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Left_1.png", trim=True)
        add_me("car_blue_up", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Up_1.png", trim=True)
        add_me("car_blue_down", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Down_1.png", trim=True)
        add_me("car_red_left", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Left_4.png", trim=True)
        add_me("car_red_up", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Up_4.png", trim=True)
        add_me("car_red_down", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Down_4.png", trim=True)
        add_me("car_green_right", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Right_10.png", trim=True)
        add_me("car_green_up", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Up_10.png", trim=True)
        add_me("car_green_down", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Down_10.png", trim=True)
        add_me("car_taxi_right", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Right_11.png", trim=True)
        add_me("car_taxi_up", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Up_11.png", trim=True)
        add_me("car_taxi_down", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Car_Down_11.png", trim=True)
        add_me("bench_h", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Bench_1.png", trim=True)
        add_me("bench_park", "17_Garden_Singles_32x32/ME_Singles_Garden_32x32_Big_Bench_Horizontal.png", trim=True)
        add_me("bistro_table", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Street_Food_Table_1.png", trim=True)
        add_me("bistro_table_2", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Street_Food_Table_3.png", trim=True)
        add_me("mailbox", "22_Post_Office_Singles_32x32/22_Post_Office_32x32_Big_Blue_Mailbox.png", trim=True)
        add_me("news_box", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Kiosk_Infopoint_Hollow_1.png", trim=True)
        add_me("hydrant", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Hydrant_1.png", trim=True)
        add_me("trashbin", "3_City_Props_Singles_32x32/ME_Singles_City_Props_32x32_Black_Closed_Trash_Can.png", trim=True)
        add_me("turnstile", "20_Subway_and_Train_Station_Singles_32x32/ME_Singles_Subway_and_Train_Station_32x32_Turnstile_Closed.png", trim=True)
        add_me("subway_stairs", "20_Subway_and_Train_Station_Singles_32x32/ME_Singles_Subway_and_Train_Station_32x32_ Stairs_Structure_1.png", trim=True)

        # Seasonal Props & Interiors Highlights
        add_me("season_pumpkin", "19_Graveyard_Singles_32x32/ME_Singles_Graveyard_32x32_Big_Pumpkin_1.png", trim=True)
        add_me("season_flower_cart", "10_Vehicles_Singles_32x32/ME_Singles_Vehicles_32x32_Fruit_Flowers_Cart_1.png", trim=True)
        add_me("season_dead_tree", "19_Graveyard_Singles_32x32/ME_Singles_Graveyard_32x32_Medium_Tree_1.png", trim=True)

        # Winter Holiday Tree from MI 15_Christmas sheet
        xmas_sheet = load_zip_img(mi_zip, "1_Interiors/32x32/Theme_Sorter_Shadowless_32x32/15_Christmas_Shadowless_32x32.png")
        xmas_tree = xmas_sheet.crop((0, 0, 64, 96))
        if xmas_tree.getbbox():
            xmas_tree = xmas_tree.crop(xmas_tree.getbbox())
        packer.add("season_xmas_tree", xmas_tree)

        # Core Room Floors from MI Room_Builder_Floors_32x32.png
        rb_floors = load_zip_img(mi_zip, "1_Interiors/32x32/Room_Bulder_subfiles_32x32/Room_Builder_Floors_32x32.png")
        packer.add("tile_wood", rb_floors.crop((1 * 32, 13 * 32, 2 * 32, 14 * 32)))
        packer.add("tile_tatami", rb_floors.crop((9 * 32, 11 * 32, 10 * 32, 12 * 32)))
        packer.add("tile_park_path", rb_floors.crop((10 * 32, 11 * 32, 11 * 32, 12 * 32)))
        packer.add("tile_plaza", rb_floors.crop((1 * 32, 3 * 32, 2 * 32, 4 * 32)))
        packer.add("tile_marble", rb_floors.crop((5 * 32, 3 * 32, 6 * 32, 4 * 32)))
        packer.add("tile_tech", rb_floors.crop((13 * 32, 13 * 32, 14 * 32, 14 * 32)))

        # Interior station furniture singles from Modern Interiors
        mi_singles_base = "1_Interiors/32x32/Theme_Sorter_Shadowless_Singles_32x32"
        def load_mi_single(sub_prefix, num):
            sub_l = sub_prefix.lower()
            suffix = f"_{num}.png"
            for p in mi_names:
                if p.startswith(mi_singles_base + "/"):
                    parts = p[len(mi_singles_base) + 1:].split("/")
                    if len(parts) == 2 and parts[0].lower().startswith(sub_l) and parts[1].endswith(suffix):
                        im = load_zip_img(mi_zip, p)
                        if im.getbbox():
                            im = im.crop(im.getbbox())
                        return im
            raise FileNotFoundError(f"Missing MI single: {sub_prefix} #{num}")

        for key, (sub_prefix, num) in [
            ("library_bookshelf", ("5_classroom_and_library", 62)),
            ("grand_piano", ("6_music_and_sport", 33)),
            ("modular_synth", ("6_music_and_sport", 165)),
            ("coffee_maker", ("12_kitchen", 154)),
            ("counter_bar", ("24_ice_cream_shop", 4)),
            ("medical_bed", ("19_hospital", 216)),
            ("hinoki_tub", ("3_bathroom", 45)),
            ("turntable", ("2_living_room", 32)),
            ("fireplace", ("2_living_room", 107)),
        ]:
            packer.add(key, load_mi_single(sub_prefix, num))

        # Interior multi-tile crops from Modern Interiors sheets
        for key, sheet_name, box in [
            ("desk_computer", "1_Interiors/32x32/Theme_Sorter_Shadowless_32x32/5_Classroom_and_library_Shadowless_32x32.png", (3 * 32, 10 * 32, 6 * 32, 12 * 32)),
            ("tea_table", "1_Interiors/32x32/Theme_Sorter_Shadowless_32x32/4_Bedroom_Shadowless_32x32.png", (0, 12 * 32, 3 * 32, 15 * 32)),
        ]:
            if sheet_name not in mi_names:
                raise FileNotFoundError(f"Missing MI sheet: {sheet_name}")
            crop_im = load_zip_img(mi_zip, sheet_name).crop(box)
            if crop_im.getbbox():
                crop_im = crop_im.crop(crop_im.getbbox())
            packer.add(key, crop_im)

        for key, path in [
            ("prop_book", "2_Characters/Character_Generator/Books/32x32/Book_32x32_01.png"),
            ("prop_phone", "2_Characters/Character_Generator/Smartphones/32x32/Smartphone_32x32_1.png"),
        ]:
            if path in mi_names:
                im = load_zip_img(mi_zip, path)
                im = im.crop((0, 0, min(32, im.width), min(64, im.height)))
                packer.add(key, im)

        rects, size = packer.build(os.path.join(out_dir, "biomes_atlas.png"))

        # Pack 5 layered Character Generator 2.0 sheets (or reuse existing charLayers if CG zip is absent)
        manifest_path = os.path.join(out_dir, "biomes_manifest.json")
        if os.path.exists(cg_path):
            with zipfile.ZipFile(cg_path) as cg_zip:
                cg_root = "Character Generator 2.0 Linux Build/Character Pieces"
                cg_names = set(cg_zip.namelist())

                def stack_cg_layer(entries, out_file):
                    canvas = Image.new("RGBA", (768, 128 * len(entries)), (0, 0, 0, 0))
                    keys = []
                    for idx, (key, path) in enumerate(entries):
                        layer = load_zip_img(cg_zip, path).crop((0, 64, 768, 192))
                        canvas.paste(layer, (0, idx * 128))
                        keys.append(key)
                    canvas.save(os.path.join(out_dir, out_file), optimize=True)
                    return {"file": out_file, "keys": keys}

                bodies = [(f"body_{i:02d}", f"{cg_root}/Bodies/32x32/Body_{i:02d}.png") for i in range(1, 10)]
                eyes = [(f"eyes_{i:02d}", f"{cg_root}/Eyes/32x32/Eyes_{i:02d}.png") for i in range(1, 8)]

                outfit_candidates = [
                    ("outfit_rittenhouse_trench", f"{cg_root}/Outfits/32x32/Outfit_28_01.png"),
                    ("outfit_athletic_tracksuit", f"{cg_root}/Outfits/32x32/Outfit_04_02.png"),
                    ("outfit_curtis_evening", f"{cg_root}/Outfits/32x32/Outfit_16_01.png"),
                    ("outfit_parc_casual", f"{cg_root}/Outfits/32x32/Outfit_12_01.png"),
                ]
                extra_outfit_files = [
                    "Outfit_01_01.png", "Outfit_02_01.png", "Outfit_03_01.png", "Outfit_05_01.png",
                    "Outfit_06_01.png", "Outfit_07_01.png", "Outfit_08_01.png", "Outfit_09_01.png",
                    "Outfit_10_01.png", "Outfit_11_01.png", "Outfit_13_01.png", "Outfit_14_01.png",
                    "Outfit_15_01.png", "Outfit_17_01.png", "Outfit_18_01.png", "Outfit_19_01.png",
                    "Outfit_20_01.png", "Outfit_21_01.png", "Outfit_22_01.png", "Outfit_24_01.png",
                    "Outfit_25_01.png", "Outfit_27_01.png", "Outfit_29_01.png", "Outfit_32_01.png",
                ]
                for fn in extra_outfit_files:
                    p = f"{cg_root}/Outfits/32x32/{fn}"
                    if p in cg_names:
                        outfit_candidates.append((fn.replace(".png", "").lower(), p))
                outfits = outfit_candidates

                hairs = []
                seen_h = set()
                for p in sorted(cg_names):
                    if f"{cg_root}/Hairstyles/32x32/" in p and p.endswith(".png"):
                        bn = p.split("/")[-1]
                        fam = bn.rsplit("_", 1)[0]
                        if fam not in seen_h:
                            seen_h.add(fam)
                            hairs.append((bn.replace(".png", "").lower(), p))
                        if len(hairs) >= 28:
                            break

                accs = []
                seen_a = set()
                for p in sorted(cg_names):
                    if f"{cg_root}/Accessories/32x32/" in p and p.endswith(".png"):
                        bn = p.split("/")[-1]
                        if any(skip in bn for skip in ["Ladybug", "Bee", "Bataclava"]):
                            continue
                        fam = bn.rsplit("_", 1)[0]
                        if fam not in seen_a:
                            seen_a.add(fam)
                            accs.append((bn.replace(".png", "").lower(), p))
                        if len(accs) >= 12:
                            break

                char_layers = {
                    "bodies": stack_cg_layer(bodies, "chars_bodies.png"),
                    "eyes": stack_cg_layer(eyes, "chars_eyes.png"),
                    "outfits": stack_cg_layer(outfits, "chars_outfits.png"),
                    "hairs": stack_cg_layer(hairs, "chars_hairs.png"),
                    "accessories": stack_cg_layer(accs, "chars_accessories.png"),
                }
        else:
            with open(manifest_path, "r", encoding="utf-8") as mf:
                char_layers = json.load(mf)["charLayers"]

    manifest = {
        "version": 2,
        "tileSize": 32,
        "atlasSize": size,
        "rects": rects,
        "charFrame": [32, 64],
        "charLayers": char_layers
    }
    with open(os.path.join(out_dir, "biomes_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    # Emit standard ESM data-URL module so both Node tests and esbuild work without special loaders
    import base64
    def to_data_url(fname):
        with open(os.path.join(out_dir, fname), "rb") as imgf:
            return "data:image/png;base64," + base64.b64encode(imgf.read()).decode("ascii")

    js_lines = [
        "// Auto-generated by scripts/pack-biomes.py — embedded PNG data URLs for single-file plugin.js serving.",
        f"export const ATLAS_DATA_URL = {json.dumps(to_data_url('biomes_atlas.png'))};",
        f"export const BODIES_DATA_URL = {json.dumps(to_data_url('chars_bodies.png'))};",
        f"export const EYES_DATA_URL = {json.dumps(to_data_url('chars_eyes.png'))};",
        f"export const OUTFITS_DATA_URL = {json.dumps(to_data_url('chars_outfits.png'))};",
        f"export const HAIRS_DATA_URL = {json.dumps(to_data_url('chars_hairs.png'))};",
        f"export const ACCESSORIES_DATA_URL = {json.dumps(to_data_url('chars_accessories.png'))};",
        ""
    ]
    with open(os.path.join(out_dir, "embedded_data.limezu.js"), "w", encoding="utf-8") as f:
        f.write("\n".join(js_lines))

    print("Packed plugin assets:", out_dir)
    print("  biomes_atlas.png:", size, "sprites:", len(rects))
    for k, v in char_layers.items():
        print(f"  chars.{k}: {v['file']} ({len(v['keys'])} strips)")


if __name__ == "__main__":
    main()
