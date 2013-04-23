if (typeof (FIT) === "undefined")
    var FIT = {};

FIT.TotalsFileMessage = function () {

    // Private

    var totals = {
        254: { "property": "message_index" },
        253: { "property": "timestamp" },
        0: { "property": "timer_time", unit : "s", comment: "Excludes pauses" },
        1: { "property": "distance", unit : "m" },
        2: { "property": "calories", unit: "kcal" },
        3: { "property": "sport" },
        4: { "property": "elapsed_time", unit : "s", comment: "Includes pauses" },
        5: { "property": "sessions" },
        6: { "property": "active_time", unit : "s" }
    };

    // Expose functions
    return {

        totals: function () {
            return totals;
        }


    }
}