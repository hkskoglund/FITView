function FileCreator() {

    this.properties = {
        0: { "property": "software_version" },
        1: { "property": "hardware_version" }
    }
}

function FileId() {
    this.properties = {
        0: { "property": "type" },
        1: { "property": "manufacturer" },
        2: { "property": "product" },
        3: { "property": "serial_number" },
        4: { "property": "time_created" },
        5: { "property": "number" }
    }
}

function Activity() {
    this. properties = {


        253: { "property": "timestamp", "unit": "s" },
                0: { "property": "position_lat", "unit": "semicirles" },
                1: { "property": "position_long", "unit": "semicirles" },
                2: { "property": "altitude", "scale": 5, "offset": 500, "unit": "m" },
                3: { "property": "heart_rate", "unit": "bpm" },
                4: { "property": "cadence", "unit": "rpm" },
                5: { "property": "distance", "scale": 100, "unit": "m" },
                6: { "property": "speed", "scale": 1000, "unit": "m/s" },
                7: { "property": "power", "unit": "watts" },
                8: { "property": "compressed_speed_distance" }, // TO DO FIX
                9: { "property": "grade", "scale": 100, "unit": "%" },
                10: { "property": "resistance" },
                11: { "property": "time_from_course", "scale": 1000, "unit": "s" },
                12: { "property": "cycle_length", "scale": 100, "unit": "m" },
                13: { "property": "temperature", "unit": "C" },
                17: { "property": "speed_1s", "unit": "m/s" },
                18: { "property": "cycles", "unit": "cycles" }, //TO DO FIX
                19: { "property": "total_cycles", "unit": "cycles" },
                28: { "property": "compressed_accumulated_power", "unit": "watts" }, // TO DO FIX
                29: { "property": "accumulated_power", "unit": "watts" },
                30: { "property": "left_right_balance" },
                31: { "property": "gps_accuracy", "unit": "m" },
                32: { "property": "vertical_speed", "scale": 1000, "unit": "m/s" },
                33: { "property": "calories", "unit": "kcal" }
    }
}