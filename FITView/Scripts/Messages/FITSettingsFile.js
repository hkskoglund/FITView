if (typeof (FIT) === "undefined")
    var FIT = {};

FIT.SettingsFileMessage = function () {

    // Private

    var device_settings = {
        1: { "property": "utc_offset" }  // Offset from system time. Required to convert timestamp from system time to UTC.
    };

    var user_profile = {
        254: { "property": "message_index" },
        0: { "property": "friendly_name" },
        1: { "property": "gender" },
        2: { "property": "age", unit : "years" },
        3: { "property": "height", unit : "m", scale : 100 },
        4: { "property": "weight", unit: "kg", scale: 10 },
        5: { "property": "language" },
        6: { "property": "elev_setting" },
        7: { "property": "weight_setting" },
        8: { "property": "resting_heart_rate" },
        9: { "property": "default_max_running_heart_rate" },
        10: { "property": "default_max_biking_heart_rate" },
        11: { "property": "default_max_heart_rate" },
        12: { "property": "hr_setting" },
        13: { "property": "speed_setting" },
        14: { "property": "dist_setting" },
        16: { "property": "power_setting" },
        17: { "property": "activity_class" },
        18: { "property": "position_setting" },
        21: { "property": "temperature_setting" },
        22: { "property": "local_id" },
        23: { "property": "global_id" },
    };

    var hrm_profile = {
        254: { "property": "message_index" },
        0: { "property": "enabled" },
        1: { "property": "hrm_ant_id" },
        2: { "property": "log_hrv" },
        3: { "property": "hrm_ant_id_trans_type" },
    };

    var sdm_profile = {
        254: { "property": "message_index" },
        0: { "property": "enabled" },
        1: { "property": "sdm_ant_id" },
        2: { "property": "sdm_cal_factor", unit : "%", scale :10 },
        3: { "property": "odometer", unit: "m", scale: 100 },
        4: { "property": "speed_source" }, // Footpod or GPS
        5: { "property": "sdm_ant_id_trans_type" }
    };
   
    var bike_profile = {
        254: { "property": "message_index" },
        0: { "property": "name" },
        1: { "property": "sport" },
        2: { "property": "sub_sport" },
        3: { "property": "odometer", unit: "m", scale: 100 },
        4: { "property": "bike_spd_ant_id"},
        5: { "property": "bike_cad_ant_id" },
        6: { "property": "bike_spdcad_ant_id" },
        7: { "property": "bike_power_ant_id" },
        8: { "property": "custom_wheelsize" , unit : "m", scale : 1000 },
        9: { "property": "auto_wheelsize", unit : "m", scale : 1000 },
        10: { "property": "bike_weight", unit : "kg", scale : 10 },
        11: { "property": "power_cal_factor", scale : 10, unit : "%" },
        12: { "property": "auto_wheel_cal" },
        13: { "property": "auto_power_zero" },
        14: { "property": "id" },
        15: { "property": "spd_enabled" },
        16: { "property": "cad_enabled" },
        17: { "property": "spdcad_enabled" },
        18: { "property": "power_enabled" },
        19: { "property": "crank_length", unit : "mm", scale: 2, offset : -110 },
        20: { "property": "enabled" },
        21: { "property": "bike_spd_ant_id_trans_type" },
        22: { "property": "bike_cad_ant_id_trans_type" },
        23: { "property": "bike_spdcad_ant_id_trans_type" },
        24: { "property": "bike_spdcad_ant_id_trans_type" }
    };

    // Expose functions
    return {

        device_settings: function () {
            return device_settings;
        },

        hrm_profile: function () {
            return hrm_profile;
        },

        sdm_profile: function () {
            return sdm_profile;
        },

        user_profile: function () {
            return user_profile;
        },

        bike_profile: function () {
            return bike_profile;
        }


    }
}