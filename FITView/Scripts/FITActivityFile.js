// Try creating "namespace" FIT in parent function execution context

var FIT = {};


if (FIT.ActivityFile === undefined)
    FIT.Activity = {};

FIT.ActivityFile = function () {


    // Private
    var fileIdProperties = {
        0: { "property": "type" },
        1: { "property": "manufacturer" },
        2: { "property": "product" },
        3: { "property": "serial_number" },
        4: { "property": "time_created" },
        5: { "property": "number" }
    };

    var fileCreatorProperties = {
        0: { "property": "software_version" },
        1: { "property": "hardware_version" }
    };

    var recordProperties = {


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
    };

    var sessionProperties = {
        254: { "property": "message_index" },
        253: { "property": "timestamp", "unit": "s" },   // Session end time
        0: { "property": "event" },
        1: { "property": "event_type" },
        2: { "property": "start_time" },
        3: { "property": "start_position_lat", "unit": "semicirles" },
        4: { "property": "start_position_long", "unit": "semicirles" },
        5: { "property": "sport" },
        6: { "property": "sub_sport" },
        7: { "property": "total_elapsed_time", "unit": "s", "scale": 1000 }, // Time (includes pauses)
        8: { "property": "total_timer_time", "unit": "s", "scale": 1000 }, // Timer Time (excludes pauses)
        9: { "property": "total_distance", "unit": "m", "scale": 100 },
        10: { "property": "total_cycles_strides" },
        11: { "property": "total_calories", "unit": "kcal" },
        // Where is 12? hmmm...
        13: { "property": "total_fat_calories", "unit": "kcal" }, // IF New Leaf
        14: { "property": "avg_speed", "unit": "m/s", "scale": 1000 },
        15: { "property": "max_speed", "unit": "m/s", "scale": 1000 },
        16: { "property": "avg_heart_rate", "unit": "bpm" },
        17: { "property": "max_heart_rate", "unit": "bpm" },
        18: { "property": "avg_cadence", "unit": "rpm" },
        19: { "property": "max_cadence", "unit": "rpm" },
        20: { "property": "avg_power", "unit": "watts" },
        21: { "property": "max_power", "unit": "watts" },
        22: { "property": "total_ascent", "unit": "m" },
        23: { "property": "total_descent", "unit": "m" },
        24: { "property": "total_training_effect", "scale": 10 },
        25: { "property": "first_lap_index" },
        26: { "property": "num_laps" },
        27: { "property": "event_group" },

        28: { "property": "trigger" },
        29: { "property": "nec_lat", "unit": "semicirles" },
        30: { "property": "nec_long", "unit": "semicirles" },
        31: { "property": "swc_lat", "unit": "semicirles" },
        32: { "property": "swc_long", "unit": "semicirles" },
        34: { "property": "normalized_power", "unit": "watts" },
        35: { "property": "training_stress_score", "unit": "tss", scale: 10 },
        36: { "property": "intensity_factor", "unit": "if", scale: 1000 },
        37: { "property": "left_right_balance", "unit": "watts" },

        41: { "property": "avg_stroke_count", "scale": 10, "unit": "strokes/lap" },
        42: { "property": "avg_stroke_distance", "scale": 100, "unit": "m" },
        43: { "property": "swim_stroke" },
        44: { "property": "pool_length", "scale": 100, "unit": "m" },
        46: { "property": "pool_length_unit" },
        47: { "property": "num_active_lengths", "unit": "lengths" }, // # active lengths of swim pool
        48: { "property": "total_work", "unit": "J" },

        49: { "property": "avg_altitude", "scale": 5, "offset": 500, "unit": "m" },
        50: { "property": "max_altitude", "scale": 5, "offset": 500, "unit": "m" },
        51: { "property": "gps_accuracy", "unit": "m" },
        52: { "property": "avg_grade", "unit": "%", "scale": 100 },
        53: { "property": "avg_pos_grade", "unit": "%", "scale": 100 },
        54: { "property": "avg_neg_grade", "unit": "%", "scale": 100 },
        55: { "property": "max_pos_grade", "unit": "%", "scale": 100 },
        56: { "property": "max_neg_grade", "unit": "%", "scale": 100 },
        57: { "property": "avg_temperature", "unit": "C" },
        58: { "property": "max_temperature", "unit": "C" },
        59: { "property": "total_moving_time", "scale": 1000, "unit": "s" },
        60: { "property": "avg_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
        61: { "property": "avg_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
        62: { "property": "max_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
        63: { "property": "max_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
        64: { "property": "min_heart_rate", "unit": "bpm" },
        65: { "property": "time_in_hr_zone", "scale": 1000, "unit": "s" }, // [N] array of N, may get some trouble here...
        66: { "property": "time_in_speed_zone", "scale": 1000, "unit": "s" }, // [N]
        67: { "property": "time_in_cadence_zone", "scale": 1000, "unit": "s" }, // [N]
        68: { "property": "time_in_power_zone", "scale": 1000, "unit": "s" },  // [N]
        69: { "property": "avg_lap_time", "scale": 1000, "unit": "s" },
        70: { "property": "best_lap_index" },
        71: { "property": "min_altitude", "scale": 5, "offset": 500, "unit": "m" }

    };

    var lapProperties = {
        254: { "property": "message_index" },
        253: { "property": "timestamp", "unit": "s" },   // Lap end time
        0: { "property": "event" },
        1: { "property": "event_type" },
        2: { "property": "start_time" },
        3: { "property": "start_position_lat", "unit": "semicirles" },
        4: { "property": "start_position_long", "unit": "semicirles" },
        5: { "property": "end_position_lat", "unit": "semicirles" },
        6: { "property": "end_position_long", "unit": "semicirles" },
        7: { "property": "total_elapsed_time", "unit": "s", "scale": 1000 }, // Time (includes pauses)
        8: { "property": "total_timer_time", "unit": "s", "scale": 1000 }, // Timer Time (excludes pauses)
        9: { "property": "total_distance", "unit": "m", "scale": 100 },
        10: { "property": "total_cycles_strides" },
        11: { "property": "total_calories", "unit": "kcal" },
        12: { "property": "total_fat_calories", "unit": "kcal" }, // IF New Leaf
        13: { "property": "avg_speed", "unit": "m/s", "scale": 1000 },
        14: { "property": "max_speed", "unit": "m/s", "scale": 1000 },
        15: { "property": "avg_heart_rate", "unit": "bpm" },
        16: { "property": "max_heart_rate", "unit": "bpm" },
        17: { "property": "avg_cadence", "unit": "rpm" },
        18: { "property": "max_cadence", "unit": "rpm" },
        19: { "property": "avg_power", "unit": "watts" },
        20: { "property": "max_power", "unit": "watts" },
        21: { "property": "total_ascent", "unit": "m" },
        22: { "property": "total_descent", "unit": "m" },
        23: { "property": "intensity" },
        24: { "property": "lap_trigger" },
        25: { "property": "sport" },
        26: { "property": "event_group" },

        // Next 4 properties not documented in profile.xls pr. 27 january 2013, but based on real data from 910XT

        27: { "property": "nec_lat", "unit": "semicirles" },
        28: { "property": "nec_long", "unit": "semicirles" },
        29: { "property": "swc_lat", "unit": "semicirles" },
        30: { "property": "swc_long", "unit": "semicirles" },

        
        32: { "property": "num_lengths", "unit": "lengths" }, // # lengths in swim pool
        33: { "property": "normalized_power", "unit": "watts" },
        34: { "property": "left_right_balance", "unit": "watts" },
        35: { "property": "first_length_index" },
        37: { "property": "avg_stroke_distance", "scale": 100, "unit": "m" },
        38: { "property": "swim_stroke" },
        39: { "property": "sub_sport" },
        40: { "property": "num_active_lengths", "unit": "lengths" },
        41: { "property": "total_work", "unit": "J" },
        42: { "property": "avg_altitude", "scale": 5, "offset": 500, "unit": "m" },
        43: { "property": "max_altitude", "scale": 5, "offset": 500, "unit": "m" },
        44: { "property": "gps_accuracy", "unit": "m" },
        45: { "property": "avg_grade", "unit": "%", "scale": 100 },
        46: { "property": "avg_pos_grade", "unit": "%", "scale": 100 },
        47: { "property": "avg_neg_grade", "unit": "%", "scale": 100 },
        48: { "property": "max_pos_grade", "unit": "%", "scale": 100 },
        49: { "property": "max_neg_grade", "unit": "%", "scale": 100 },
        50: { "property": "avg_temperature", "unit": "C" },
        51: { "property": "max_temperature", "unit": "C" },
        52: { "property": "total_moving_time", "scale": 1000, "unit": "s" },
        53: { "property": "avg_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
        54: { "property": "avg_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
        55: { "property": "max_pos_vertical_speed", "scale": 1000, "unit": "m/s" },
        56: { "property": "max_neg_vertical_speed", "scale": 1000, "unit": "m/s" },
        57: { "property": "time_in_hr_zone", "scale": 1000, "unit": "s" },
        58: { "property": "time_in_speed_zone", "scale": 1000, "unit": "s" },
        59: { "property": "time_in_cadence_zone", "scale": 1000, "unit": "s" },
        60: { "property": "time_in_power_zone", "scale": 1000, "unit": "s" },
        61: { "property": "repetition_num", "scale": 1000, "unit": "s" },
        62: { "property": "min_altitude", "scale": 5, "offset": 500, "unit": "m" },
        63: { "property": "min_heart_rate", "unit": "m" },
        71: { "property": "wkt_step_index", "unit": "bpm" }
    };

    var hrvProperties = {
        0: { "property": "time", "unit": "s", "scale": 1000 } // Array of N elements.... [N] according to SDK profile.xls
    };

    var eventProperties = {
        253: { property: "timestamp", "unit": "s" },
        0: { property: "event" },
        1: { property: "event_type" },
        2: { property: "data16" },
        3: { property: "data" },
        4: { property: "event_group" }
    };


    var activityProperties = {
        253: { "property": "timestamp", "unit": "s" },
        0: { "property": "total_timer_time", "scale": 1000, "unit": "s" }, // Excluding pauses
        1: { "property": "num_sessions" },
        2: { "property": "type" },
        3: { "property": "event" },
        4: { "property": "event_type" },
        5: { "property": "local_timestamp" },
        6: { "property": "event_group" }
    };


    var deviceInfoProperties = {
        253: { "property": "timestamp", "unit": "s" },
        0: { "property": "device_index" }, 
        1: { "property": "device_type" },
        2: { "property": "manufacturer" },
        3: { "property": "serial_number" },
        4: { "property": "product" },
        5: { "property": "software_version", "scale" : 100 },
        6: { "property": "hardware_version" },
        7: { "property": "cum_operating_time", unit : "s" }, // Reset by new battery or charge
        10: { "property": "battery_voltage", "scale": 256, unit: "V" },
        11: { "property": "battery_status" }

        //// Mysterious 90XT fielddef.
        //9: { "property": "unknown9" },
        //15: { "property": "unknown15" },
        //16: { "property": "unknown16" }

    };

    var lengthProperties = {
        254: { "property": "message_index" },
        253: { "property": "timestamp", "unit": "s" },
        0: { "property": "event" },
        1: { "property": "event_type" },
        2: { "property": "start_time" },
        3: { "property": "total_elapsed_time", "scale": 1000, "unit" : "s" },
        4: { "property": "total_timer_time", "scale": 1000, "unit": "s" },
        5: { "property": "total_strokes", "unit" : "strokes" },
        6: { "property": "avg_speed", "scale" : 1000, "unit" : "m/s" },
        7: { "property": "swim_stroke" }, 
        9: { "property": "avg_swimming_cadence", unit: "strokes/min" },
        10: { "property": "event_group" },
        11: { "property": "total_calories", unit : "kcal" },
        12: { property: "length_type" }
    };

    // Expose functions
    return {

        fileId: function () {
            return fileIdProperties;
        },

        fileCreator: function () {
            return fileCreatorProperties;
        },

        record: function () {
            return recordProperties;
        },

        session: function () {
            return sessionProperties;
        },

        lap: function () {
            return lapProperties;
        },

        hrv: function () {
            return hrvProperties;
        },

        activity: function () {
            return activityProperties;
        },

        event: function () {
            return eventProperties;
        },

        deviceInfo : function () {
        return deviceInfoProperties;
        },

        length: function () {
            return lengthProperties;
        }
    };


};
