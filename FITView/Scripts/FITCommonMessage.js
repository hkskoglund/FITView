if (typeof (FIT) === "undefined")
  var FIT = {};

FIT.CommonMessage = function () {

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

    // Expose functions
    return {

        fileId: function () {
            return fileIdProperties;
        },

        fileCreator: function () {
            return fileCreatorProperties;
        }
    }
}