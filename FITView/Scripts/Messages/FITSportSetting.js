if (typeof (FIT) === "undefined")
    var FIT = {};

FIT.SportSettingMessage = function () {

    // Private
    var zones_target = {
        1: { "property": "max_heart_rate" },
        2: { "property": "threshold_heart_rate" },
        3: { "property": "functional_threshold_power" },
        5: { "property": "hr_calc_type" },
        7: { "property": "pwr_calc_type" },
    };

    var sport = {
        0: { "property": "sport" },
        1: { "property": "sub_sport" },
        3: { "property": "name" }
    };

    var hr_zone = {
        254: { property: "message_index" },
        1: { property: "high_bpm", unit : "bpm" },
        2: { property: "name" }
    };

    var speed_zone = {
        254: { property: "message_index" },
        0: { property: "high_value", scale : 1000, unit: "m/s" },
        1: { property: "name" }
    };

    var cadence_zone = {
        254: { property: "message_index" },
        0: { property: "high_value", unit: "rpm" },
        1: { property: "name" }
    };

    var power_zone = {
        254: { property: "message_index" },
        1: { property: "high_value", unit: "watts" },
        2: { property: "name" }
    };

    var met_zone = {
        254: { property: "message_index" },
        1: { property: "high_bpm", unit: "bpm" },
        2: { property: "calories", scale: 10, unit :"kcal/min" },
        3: { property: "fat_calories", scale: 10, unit:"kcal/min" }
    };

    // Expose functions
    return {

        zones_target: function () {
            return zones_target;
        },

        sport: function () {
            return sport;
        },

        hr_zone: function () {
            return hr_zone;
        },

        speed_zone: function () {
            return speed_zone;
        },

        cadence_zone: function () {
            return cadence_zone;
        },

        power_zone: function () {
            return power_zone;
        },

        met_zone: function () {
            return met_zone;
        }
    }
}