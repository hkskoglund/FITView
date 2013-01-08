// Garmin datetime = seconds since UTC 00:00 Dec 31 1989
// If Garmin date_time is < 0x10000000 then it is system time (seconds from device power on)

function GarminDateTime() {

    this.MIN = 0x10000000; 
    // Date.UTC(1989,11,31) - Date.UTC(1970,0,1)
    this.OFFSET = 631065600000; // Offset between Garmin (FIT) time and Unix time in ms (Dec 31, 1989 - 00:00:00 January 1, 1970).
    //this.timestamp = timestamp || undefined;
    this.timezoneOffset = this.getTimezoneOffset();
    this.timestamp = 0;

}

GarminDateTime.prototype.getTimezoneOffset = function () {
    var d = new Date();
    return d.getTimezoneOffset();
}

GarminDateTime.prototype.setTimestamp = function (timestamp) {
    this.timestamp = timestamp;
}

GarminDateTime.prototype.getTimeStamp = function getTimestamp() {
    return this.timestamp;
}

GarminDateTime.prototype.convertTimestampToLocalTime = function () {
    //var d = new Date();
    return this.timestamp * 1000 + this.OFFSET + this.timezoneOffset * 60 * 1000 * -1;
    //return d;
}
