// JSHint options
/* global ko:true, Highcharts:true, Modernizr:true, google:true, indexedDB:true, FIT:true */

(function () {
    "use strict";
    var self;

    var lapxAxisID = 'lapxAxis',
        rawdataxAxis = 'rawdataxAxis',
        combinedxAxisID = "combinedxAxis", // For speed vs HR
        hrvxAxisID = "hrvxAxis"; 

    // Based on info. in profile.xls from FIT SDK
    var FITSport = {

        generic: 0,
        running: 1,
        cycling: 2,
        transition: 3, // Multisport transition
        fitness_equipment: 4,
        swimming: 5,
        basketball: 6,
        soccer: 7,
        tennis: 8,
        american_fotball: 9,
        training: 10,
        all: 254 // All is for goals only to include all sports.
    };

    var lap_trigger = {

        manual: 0,
        time: 1,
        distance: 2,
        position_start: 3,
        position_lap: 4,
        position_waypoint: 5,
        position_marked: 6,
        session_end: 7
    };

    var FITFileType = {

        sportsettingfile : 3,
        activityfile : 4
    };

    var FITUtil =
        {
            getTimestampString: function(timestamp)
            {
                return timestamp.toString()+" = "+(new Date(timestamp)).toUTCString();
              
            },

            isUndefined: function (what) {
                if (typeof (what) === "undefined")
                    return true;
                else
                    return false;
            },

            isEmpty: function (arr) {
                if (arr.length === 0)
                    return true;
                else
                    return false;
            },

            hasGPSData: function (rawdata) {

                if (rawdata.record.position_lat === undefined) {
                    self.loggMessage("info","No position data (position_lat)");
                }

                if (rawdata.record.position_long === undefined) {
                    self.loggMessage("info","No position data (position_lat)");
                }

                return (rawdata.record.position_lat === undefined || rawdata.record.position_long === undefined) ? false : true;
            },

            // Combines two series, i.e heart rate and speed
            // It is only used after (combine-func. with timestamps = series) to allow for filtering done there
            combineTwo: function (series1, series2) {
                // Pre-conditions

                if (FITUtil.isUndefined(series1) || FITUtil.isUndefined(series2)) {
                    self.loggMessage("error","Undefined series, cannot combine them.");
                    return undefined;
                }

                if (FITUtil.isEmpty(series1) || FITUtil.isEmpty(series2)) {
                    self.loggMessage("error","Empty series, cannot combine them.");
                    return undefined;
                }

                var lenSeries1 = series1.length;
                var lenSeries2 = series2.length;

                if (lenSeries1 !== lenSeries2) {
                    self.loggMessage("warn","Length of combined series does not match ", lenSeries1, lenSeries2);
                }

                var elementNr;
                var combined = [];
                var timestamp = 0;
                var value = 1;

                for (elementNr = 0; elementNr < lenSeries1 && elementNr < lenSeries2; elementNr++) {
                    if (series1[elementNr][timestamp] === series2[elementNr][timestamp]) // If equal timestamps
                        combined.push([series1[elementNr][value], series2[elementNr][value]]);
                }

                return combined;
            },

            // This function combines a series of data, i.e heart rate with timestamps to facilitate easy setup for plotting in Highcharts
            // It also can calculate averaging over a specific time period, i.e to smooth out speed curve that has a tendency to fluctate rather much when based on GPS
            combine: function (rawdata, values, timestamps, startTimestamp, endTimestamp, converter, seriesName, averaging, avgSampleTime) {

                var combined = [];
                var localTimestamp;  // Timestamp in local time zone
                var valuesForAverage;
                var len, nr, timestamp, nextTimestamp, prevTimestampNr;
                var sum, avg, val;

                function sumTwoNumbers(a, b) {
                    return a + b;
                }

                if (timestamps === undefined) {
                    self.loggMessage("warn","Found no timestamps to combine with data measurements.", seriesName);
                    return values;
                }

                if (values.length !== timestamps.length)
                    self.loggMessage("warn","Length of arrays to combine is not of same size; values length = " + values.length.toString() + " timestamp length = " + timestamps.length.toString(), seriesName);

                if (startTimestamp === undefined || endTimestamp === undefined) {
                    self.loggMessage("error","Either startTimestamp or endTimestamp is undefined, cannot continue, array not combined with timestamps, series:", seriesName);
                    return values;
                    // But, could perhaps add relative start time...?
                }

                len = timestamps.length;

                for (nr = 0; nr < len; nr++) {

                    timestamp = timestamps[nr];  // UTC timestamp in rawdata

                    if (rawdata.dirty[nr]) // Skip dirty data
                        continue;

                    if (timestamp >= startTimestamp && timestamp <= endTimestamp) {

                        if (!FITUtil.isUndefined(averaging) && averaging) {
                            //console.log("Nr. before avg:", nr);

                            valuesForAverage = [];
                            nextTimestamp = timestamp;

                            while (nextTimestamp - timestamp <= avgSampleTime && nextTimestamp <= endTimestamp && nr < len) {

                                 val = values[nr];

                                if (val !== undefined) {
                                    localTimestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(timestamp);

                                    if (converter)
                                        valuesForAverage.push(converter(val));
                                    else
                                        valuesForAverage.push(val);

                                } else
                                    self.loggMessage("log","Tried to combine timestamp ", FITUtil.getTimestampString(timestamp), " with undefined value at index", nr, " series: ", seriesName);

                                prevTimestampNr = nr;
                                nextTimestamp = timestamps[++nr];
                            }

                            if (prevTimestampNr)
                                nr = prevTimestampNr;

                            //console.log("Nr. after avg:", nr);

                            //Credit to: http://stackoverflow.com/questions/10359907/array-sum-and-average

                            if (valuesForAverage.length > 0) {
                                sum = valuesForAverage.reduce(sumTwoNumbers);
                                avg = sum / valuesForAverage.length;
                            } else {
                                self.loggMessage("warn","Empty array to calculate average for series", seriesName, " local timestamp is : ", localTimestamp);
                                avg = 0;
                            }

                            combined.push([localTimestamp, avg]);
                        }
                        else if (FITUtil.isUndefined(averaging) || averaging === false || averaging === null) {

                            val = values[nr];

                            if (val !== undefined) {
                                localTimestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(timestamp);

                                if (converter)
                                    combined.push([localTimestamp, converter(val)]);
                                else
                                    combined.push([localTimestamp, val]);
                            } else
                                self.loggMessage("log","Tried to combine timestamp ", FITUtil.getTimestampString(timestamp), " with undefined value at index", nr, " series: ", seriesName);

                        }

                        if (timestamp > endTimestamp)
                            break;
                    }
                }

                return combined;

            },

            setDirtyTimestamps: function (rawdata, timestamps) {

                if (FITUtil.isUndefined(timestamps)) {
                    self.loggMessage("error","No timestamps - its undefined");
                    return undefined;
                }

                if (timestamps.length === 0) {
                    self.loggMessage("warn","Empty timestamps, no one found to analyze for artifacts");
                    return undefined;
                }

                rawdata.dirty = [];

                var max = 1000 * 60*60 ; // Allows for 1 hour between timestamps
                var oneWeek = 1000 * 60*60 * 24 * 7; // Allows for 1 week multisport activity

                var len = timestamps.length;
                var timeDiff; // Difference between succeeding timestamp

                var start_time = timestamps[0];
                var maxLimit = start_time + oneWeek;

                self.loggMessage("log","Start time is", FITUtil.getTimestampString(start_time),", marking timestamps with UTC over ", FITUtil.getTimestampString(maxLimit), "and if time difference between timestamps is over ",max," millisec. as dirty");
                var dirtyCounter = 0;

                for (var index = 0; index < len; index++) {
                    if (index + 1 <= len - 1) {
                        timeDiff = timestamps[index + 1] - timestamps[index];
                        if (timeDiff > 0 && timeDiff <= max && timestamps[index] <= maxLimit)
                            rawdata.dirty[index] = false;
                        else {
                            self.loggMessage("warn","Found dirty timestamp ", timestamps[index], " at index ", index,"time difference between timestamp is ",timeDiff);
                            rawdata.dirty[index] = true;
                            dirtyCounter++;
                        }
                    } else  // Last timestap
                    {
                        if (timestamps[index] < maxLimit)
                            rawdata.dirty[index] = false;
                        else {
                            self.loggMessage("warn","Found dirty timestamp ", timestamps[index], " at index ", index);
                            rawdata.dirty[index] = true;
                            dirtyCounter++;
                        }
                    }
                }

                self.loggMessage("log","Number of dirty timestamps : ", dirtyCounter);

            },

            restoreSession: function (rawData) {
               
                var currentSport;
                var prevSport;
                var lastEndtimstamp;
                var total_elapsed_time;
                var total_timer_time;
                var total_distance;
                var total_calories;
                var diff;
                var recordNr;

                rawData.session = {};
                rawData.session.sport = [];
                rawData.session.start_time = [];
                rawData.session.timestamp = [];
                rawData.session.total_elapsed_time = [];
                rawData.session.total_timer_time = [];
                rawData.session.total_distance = [];
                rawData.session.total_calories = [];

                // Try to restore session from available lap data
                if (rawData.lap) {
                    var numberOfLaps = rawData.lap.timestamp.length;

                    for (var lapNr = 0; lapNr < numberOfLaps; lapNr++) {
                        currentSport = rawData.lap.sport[lapNr];

                        if (currentSport !== prevSport) {
                            if (total_elapsed_time)
                                rawData.session.total_elapsed_time.push(total_elapsed_time);
                            total_elapsed_time = rawData.lap.total_elapsed_time[lapNr];

                            if (total_timer_time)
                                rawData.session.total_timer_time.push(total_timer_time);
                            total_timer_time = rawData.lap.total_timer_time[lapNr];

                            if (total_distance)
                                rawData.session.total_distance.push(total_distance);
                            total_distance = rawData.lap.total_distance[lapNr];

                            if (total_calories)
                                rawData.session.total_calories.push(total_calories);
                            total_calories = rawData.lap.total_calories[lapNr];

                            if (lastEndtimstamp !== undefined)
                                rawData.session.timestamp.push(rawData.lap.timestamp[lapNr - 1]);

                            if (numberOfLaps === 1)
                                lastEndtimstamp = rawData.lap.timestamp[lapNr];

                            rawData.session.sport.push(currentSport);
                            rawData.session.start_time.push(rawData.lap.start_time[lapNr]);

                        } else {
                            total_elapsed_time += rawData.lap.total_elapsed_time[lapNr];
                            total_timer_time += rawData.lap.total_timer_time[lapNr];
                            total_distance += rawData.lap.total_distance[lapNr];
                            total_calories += rawData.lap.total_calories[lapNr];

                            lastEndtimstamp = rawData.lap.timestamp[lapNr - 1];
                        }
                        prevSport = currentSport;
                    }

                    if (total_elapsed_time)
                        rawData.session.total_elapsed_time.push(total_elapsed_time);

                    if (total_timer_time)
                        rawData.session.total_timer_time.push(total_timer_time);

                    if (total_distance)
                        rawData.session.total_distance.push(total_distance);

                    if (total_calories)
                        rawData.session.total_calories.push(total_calories);

                    if (lastEndtimstamp)
                        rawData.session.timestamp.push(rawData.lap.timestamp[lapNr - 1]);

                } else { // Create a generic session of all data

                    rawData.session.sport.push(FITSport.generic);

                    if (rawData.record) {
                        var lastRecordIndex = rawData.record.timestamp.length - 1;

                        var timestamp = rawData.record.timestamp[lastRecordIndex];
                        rawData.session.timestamp.push(timestamp);

                        var start_time = rawData.record.timestamp[0];
                        rawData.session.start_time.push(start_time);

                        total_elapsed_time = (timestamp - start_time) / 1000;
                        if (total_elapsed_time && total_elapsed_time >= 0) {
                            rawData.session.total_elapsed_time.push(total_elapsed_time);
                            rawData.session.total_timer_time.push(total_elapsed_time);
                        }
                        else
                            self.loggMessage("error","Something is wrong with start and/or end timestamp", start_time, timestamp);

                        // Take a guess on distance - assume one single session
                        // Drawback : does not check for multiple sessions
                        // Want: keep things quite simple...

                        var distance = rawData.record.distance[lastRecordIndex];
                        rawData.session.total_distance.push(distance);

                        var total_ascent = 0;
                        var total_descent = 0;
                        var altitude, previousAltitude = 0;

                        if (rawData.record.altitude) {
                            for (recordNr = 0; recordNr < lastRecordIndex; recordNr++) {
                                if (rawData.record.altitude[recordNr]) {
                                    altitude = rawData.record.altitude[recordNr];
                                    diff = altitude - previousAltitude;
                                    if (diff < 0)
                                        total_descent += diff * -1;
                                    else
                                        total_ascent += diff;
                                    previousAltitude = altitude;
                                } else
                                    break;
                            }

                            rawData.session.total_ascent = [];
                            rawData.session.total_descent = [];

                            rawData.session.total_ascent.push(parseFloat(total_ascent.toFixed(1)));
                            rawData.session.total_descent.push(parseFloat(total_descent.toFixed(1)));
                        }
                    } else
                        self.loggMessage("warn","No data present on rawdata.record for restoration of session");

                    // TO DO : calculate avg./max for speed, HR, ... not prioritized

                }

                return rawData.session;
            },

            getIndexOfTimestamp: function (record, timestamp) {

                var findNearestTimestamp = function (timestamp) {

                    // Try to get from cache first
                    if (typeof (self.timestampIndexCache) === "undefined") {
                        self.loggMessage("log","Initialized timestamp index cache");
                        self.timestampIndexCache = [];
                    }

                    for (var cacheItem = 0; cacheItem < self.timestampIndexCache.length; cacheItem++)
                        if (self.timestampIndexCache[cacheItem].key === timestamp)
                            return self.timestampIndexCache[cacheItem].value;

                    var indxNr = -1;
                    var breaked = false;
                    var len = record.timestamp.length;
                    for (indxNr = 0; indxNr < len; indxNr++) {
                        if (record.timestamp[indxNr] >= timestamp) {
                            breaked = true;
                            break;
                        }
                    }

                    if (breaked) {
                        self.timestampIndexCache.push({ key: timestamp, value: indxNr });
                        return indxNr;
                    }
                    else {
                        self.timestampIndexCache.push({ key: timestamp, value: indxNr - 1 });
                        return indxNr - 1;
                    }
                };

                if (timestamp === undefined) {
                    self.loggMessage("error","Cannot lookup/find index in timestamp array of an undefined timestamp");
                    return -1;
                }

                var indexTimestamp;

                indexTimestamp = record.timestamp.indexOf(timestamp);
                if (indexTimestamp === -1) {
                    self.loggMessage("warn","Direct lookup for timestamp ", FITUtil.getTimestampString(timestamp), " not found, looping through available timestamps on message property record.timestamp to find nearest");
                    indexTimestamp = findNearestTimestamp(timestamp);
                }

                return indexTimestamp;

            },

            timestampUtil: FIT.CRCTimestampUtility() // Returns exposable functions that can be called in an object literal
        };

    var fitActivity = FIT.ActivityFile();

    var converter = {

        formatToMMSS: function (speed) {
            if (speed === 0)
                return "00:00";

            var minutes = Math.floor(speed);
            var seconds = parseInt(((speed - minutes) * 60).toFixed(), 10); // implicit rounding
            if (seconds === 60) {
                seconds = 0;
                minutes += 1;
            }

            var result = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);

            return result;
        },

        convertSpeedToMinPrKM: function (speed) {
            // speed in m/s to min/km
            if (speed === 0)
                return 0;
            else
                return 1 / (speed * 60 / 1000);
        },

        convertSpeedToKMprH: function (speed) {
            // raw speed in m/s to km/h
            if (speed === 0)
                return 0;
            else
                return speed * 3.6; // 3.6 = 3600 s/h / 1000 m/km
        },

        convertSecsToHHMMSSModel: function (totalSec) {
            // Callback on "create" from knockout
            //ko.mapping.fromJS(totalSec, {}, this); //Maybe not needed on scalar object

            this.value = totalSec;


            this.toHHMMSS = ko.computed(function () {
                // http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript

                var hours = parseInt(totalSec / 3600, 10) % 24;
                var minutes = parseInt(totalSec / 60, 10) % 60;
                var seconds = parseInt(totalSec % 60, 10);

                var hourResult;
                if (hours !== 0)
                    hourResult = (hours < 10 ? "0" + hours : hours) + ":";
                else
                    hourResult = "";

                var result = hourResult + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
                return result;
            }, this);
        },

        convertSpeedConverterModel: function (speedMprSEC) {

            //ko.mapping.fromJS(speedMprSEC, {}, this);

            var minPrKM;
            var minPr100M;

            this.value = speedMprSEC;

            this.toMINpr100M = ko.computed(function () {

                if (speedMprSEC > 0)
                    minPr100M = 1 / (speedMprSEC * 60 / 100); // min/100m
                else
                    minPr100M = 0;

                return converter.formatToMMSS(minPr100M);
            }, self);

            this.toMINprKM = ko.computed(function () {

                minPrKM = converter.convertSpeedToMinPrKM(speedMprSEC);
                return converter.formatToMMSS(minPrKM);
            }, self);

            this.toKMprH = ko.computed(function () {
                var kmPrH = (speedMprSEC * 3.6).toFixed(1);
                return kmPrH;
            }, self);

        },

        convertToFullDate: function (UTCmillisec)
            //// Callback on "create" from knockout
        {
            this.value = UTCmillisec;
            this.fullDate = ko.computed(function () {
                return Highcharts.dateFormat('%A %e %B %Y %H:%M:%S', UTCmillisec);
            }, this);
        },

    };

    var FITViewUIConverter = converter;

    //View models
    var FITViewUI = {
        
        masterVM: {

            exportVM: {
                csv: {
                    type: ko.observableArray(['raw', 'scatter', 'bar/column']),
                    selectedType: ko.observable(),
                    header: ko.observable(false),
                    headerTitle: ko.observable('time'),
                    scale: ko.observable(1),
                    blob : {},
                    url: ko.observable()
                } // URL for CSV blob
            },

            activityVM: {
                selectedActivity : ko.observable(undefined),
                activity : ko.observableArray()
            },

            speedMode: ko.observable(),

            headerInfoVM: {

                fileName: ko.observable(),
                fileSize: ko.observable(),
                headerSize: ko.observable(),
                dataSize: ko.observable(),
                estimatedFitFileSize: ko.observable(),
                protocolVersion: ko.observable(),

                profileVersion: ko.observable(),

                dataType: ko.observable(),
                headerCRC: ko.observable(),
                verifyHeaderCRC: ko.observable() // Second verification of CRC of the .FIT file

            },

            settingsVM: {
                timeZoneDifferenceUTC: FITUtil.timestampUtil.getTimezoneOffsetFromUTC(),
                showLapLines: ko.observable(true),
                showLapTriggers: ko.observable(false),
                showEvents: ko.observable(false),
                showLegends: ko.observable(true),
                storeInIndexedDB: ko.observable(false),
                showDeviceInfo: ko.observable(false),
                showHeaderInfo: ko.observable(false),
                forceSpeedKMprH: ko.observable(false),
                requestAveragingOnSpeed: ko.observable(true),
                averageSampleTime: ko.observable(5000),
                logging: ko.observable(false),
                distanceOnXAxis : ko.observable(false)
                //requestHideAltitude : ko.observable(true)
            },

            progressVM: {
                progress: ko.observable(0) // For reporting progress from import worker thread
            },
        },

        // Initialization of view models and some checks for desired functinality of the browser environment/user agent
        init: function () {

            self = this;

            // Had to introduce this due to some issues with databinding, if new properties was introduced in rawdata,
            // databinding would not kick in even when data is mapped ok. Probably is due to some issues with <!-- ko: if -->
            // virtual elements and something with "changed" value notification. Introducing empty observables on unused properties gives a performance penalty.
            function getEmptyViewModel(msg) {

                var ViewModel = {};

                for (var fieldDefNr in msg)
                    ViewModel[msg[fieldDefNr].property] = ko.observableArray([]);

                return ViewModel;

            }

            //loadSeriesViaButtonViewModel = function () {
            //    //var self = this;
            //    // var chart, seriesData;

            //    //self.chart = chart;
            //    //self.seriesData = seriesData;

            //    setNewChartAndSeriesData = function (chart, seriesData) {
            //        self.chart = chart;
            //        self.seriesData = seriesData;
            //    }

            //    loadChart = function () {
            //        // this is highchart series id.
            //        var id = this.id;
            //        var name = this.name;

            //        var series = self.chart.get(id);

            //        if (typeof (series) === "undefined" || series === null) {
            //            if (self.seriesData[id]) {
            //                console.log("Loading series id: ", id);
            //                self.chart.addSeries({
            //                    name: name,
            //                    id: id,
            //                    data: self.seriesData[id]
            //                });
            //            } else
            //                console.warn("No data available for load request of series id: ", id);
            //        }
            //            //if (series && series.data.length === 0) {
            //            //    // Add only fresh data

            //            //    series.setData(self.seriesData[id]);

            //            //}
            //        else
            //            console.error("Data already loaded, skipped series id", id);
            //    }

            //}

            self.masterVM.exportVM.csv.selectedType(self.masterVM.exportVM.csv.type()[0]); // Raw CSV export by default


            self.masterVM.sessionVM = getEmptyViewModel(fitActivity.session());
            self.masterVM.lapVM = getEmptyViewModel(fitActivity.lap());

            //  self.masterVM.loadChartVM = new loadSeriesViaButtonViewModel();
            self.masterVM.loadChartVM = {};

            if (!Modernizr.webworkers) {
                alert("This application will not work due to lack of webworker functionality");
            }

            if (!Modernizr.indexeddb) {
                alert("This application will not work due to lack of indexedDB");
            }

            if (!Modernizr.geolocation) {
                alert("This application will not work due to lack of geolocation");
            }

          

            this.inpFITFile = document.getElementById('inpFITFile');
            this.inpFITFile.addEventListener('change', this.onFitFileSelected, false);

            //FITUI.btnSaveZones = document.getElementById('btnSaveZones')
            //FITUI.btnSaveZones.addEventListener('click', saveHRZones, false);

            this.divMsgMap = document.getElementById('divMsgMap');

            this.progressFITImport = document.getElementById('progressFITImport');

            this.divSessionLap = $('#divSessionLap');

            //this.masterVM.lapVM.speedMode = ko.observable();

            // Make sure we always is ready to export CSV data when user changes parameters
            this.masterVM.exportVM.csv.header.subscribe(function (header) {
                self.setupHRVexport(self.masterVM.sessionVM.rawData);
            });

            this.masterVM.exportVM.csv.scale.subscribe(function (scale) {
                self.setupHRVexport(self.masterVM.sessionVM.rawData);
            });

            this.masterVM.exportVM.csv.selectedType.subscribe(function (scale) {
                self.setupHRVexport(self.masterVM.sessionVM.rawData);
            });

            this.masterVM.exportVM.csv.tryMSBlobSave = function (data, event) {
               
                //http://knockoutjs.com/documentation/click-binding.html Note 3 - return true to let event let event navigate to href
                //http://msdn.microsoft.com/en-us/library/ie/hh779016(v=vs.85).aspx Saving files locally using Blob and msSaveBlob
                if (typeof window.navigator.msSaveBlob !== "undefined") {
                    window.navigator.msSaveBlob(self.masterVM.exportVM.csv.blob, "export.csv");
                } else
                  return true;
            };

            // http://stackoverflow.com/questions/11177565/knockoutjs-checkbox-changed-event
            this.masterVM.settingsVM.showLapLines.subscribe(function (showLapLines) {
                // Callback from knockoutjs
                if (!showLapLines) {
                    if (self.multiChart)
                        self.multiChart.xAxis[0].removePlotLine('plotLines');
                }
                else
                    if (self.multiChart)
                        self.addLapLines(self.masterVM.sessionVM.rawData, self.multiChart);
            });

            this.masterVM.settingsVM.showLapTriggers.subscribe(function (showLapTriggers) {

                if (showLapTriggers)
                    self.showLapTriggers(self.masterVM.sessionVM.rawData);
                else
                    self.removeSVGGroup(self.masterVM.lapTriggerGroup);


            });

            this.masterVM.settingsVM.showEvents.subscribe(function (showEvents) {

                if (showEvents)
                    self.showEvents(self.masterVM.sessionVM.rawData);
                else
                    self.removeSVGGroup(self.masterVM.eventGroup);


            });

            this.masterVM.settingsVM.showDeviceInfo.subscribe(function (showDeviceInfo) {

                if (showDeviceInfo)
                    self.showDeviceInfo(self.masterVM.sessionVM.rawData);
                else
                    self.removeSVGGroup(self.masterVM.deviceInfoGroup);


            });

            this.masterVM.settingsVM.distanceOnXAxis.subscribe(function (distanceOnXAxis) {
                if (self.multiChart)
                    self.multiChart.redraw();
            });

            this.masterVM.settingsVM.forceSpeedKMprH.subscribe(self.adjustSpeed);

            var bodyId = '#divSessionLap';
            var jqueryBodyElement = $(bodyId);
            var bodyElement = jqueryBodyElement[0];


            this.masterVM.sessionVM.selectedSession = ko.observable(undefined);
            this.masterVM.sessionVM.tempoOrSpeed = ko.observable(undefined);
            this.masterVM.lapVM.tempoOrSpeed = ko.observable(undefined);
            this.masterVM.lapVM.selectedLap = ko.observable(undefined);

            // Maybe: set rawdata on masterVM
            this.masterVM.sessionVM.setRawdata = function (self, rawData) {
                self.masterVM.sessionVM.rawData = rawData;
            };

            this.masterVM.lapVM.setRawdata = function (self, rawData) {
                self.masterVM.lapVM.rawData = rawData;
            };

            this.masterVM.sessionVM.showSession = function (data, event) {
                // In callback from knockoutjs, this = first argument to showDetails.bind(...) == index, then $data and event is pushed
                var index = this;
                var VM = self.masterVM.sessionVM;
                var start_time = VM.rawData.session.start_time[index];
                var timestamp = VM.rawData.session.timestamp[index];
                var sport = VM.rawData.session.sport[index];

                self.masterVM.lapVM.selectedLap(undefined);
                VM.selectedSession(index);

                var polylinePlotted = self.showPolyline(VM.rawData, self.map, VM.rawData.record, start_time, timestamp,
                    {
                        strokeColor: 'red',
                        strokeOpacity: 1,
                        strokeWeight: 1
                    }, "session");

                self.showHRZones(VM.rawData, start_time, timestamp);

                self.showMultiChart(VM.rawData, start_time, timestamp, sport);
            };

            this.masterVM.activityVM.showActivity = function (data, event) {
                // In callback from knockoutjs, this = first argument to showDetails.bind(...) == index, then $data and event is pushed
                //var index = this;
                //var VM = self.masterVM.sessionVM;
                //var start_time = VM.rawData.session.start_time[index];
                //var timestamp = VM.rawData.session.timestamp[index];
                //var sport = VM.rawData.session.sport[index];
                var index = this;
                var VM = self.masterVM.activityVM;
                var rawData = VM.activity()[index];  // Takes the index element of an observable array which is an observable with value an array -> tracks elements in array not properties
                VM.selectedActivity(index);
                self.processActivityFile(rawData);
            };

            //this.masterVM.activityVM.selectedActivity.subscribe(function (selectedActivity) {
            //});

            this.masterVM.lapVM.showLap = function (data, event) {
                // In callback from knockoutjs, this = first argument to showDetails.bind(...) == index, then $data and event is pushed
                var index = this;
                var VM = self.masterVM.lapVM;
                var start_time = VM.rawData.lap.start_time[index];
                var timestamp = VM.rawData.lap.timestamp[index];
                var sport = VM.rawData.lap.sport[index];

                self.masterVM.sessionVM.selectedSession(undefined);
                VM.selectedLap(index);

                var polylinePlotted = self.showPolyline(VM.rawData, self.map, VM.rawData.record, start_time, timestamp, {
                    strokeColor: 'blue',
                    strokeOpacity: 1,
                    strokeWeight: 2
                }, "lap");

                self.showHRZones(VM.rawData, start_time, timestamp);

                self.showMultiChart(VM.rawData, start_time, timestamp, sport);
            };

            ko.applyBindings(this.masterVM, bodyElement); // Initialize master model with DOM 
            jqueryBodyElement.show();

            // Initialize map
            if (this.map === undefined)
                this.map = this.initMap();
        },

        adjustSpeed: function (forceSpeedKMprH) {

            var speedSeries, speedAvgSeries;
            var speedSeriesData, speedAvgSeriesData;
            var lapAvgSpeedSeries, lapMaxSpeedSeries;
            
            var rawData = self.masterVM.sessionVM.rawData;
            var timezoneDiff = FITUtil.timestampUtil.getTimezoneOffsetFromUTC();
            var startTimestamp, endTimestamp;

            var updatePoint = function (data, property, converter) {
                for (var pointNr = 0; pointNr < data.length; pointNr++)
                    data[pointNr].update(converter(rawData.lap[property][pointNr]), false);

            };

            if (self.multiChart) {
                speedSeries = self.multiChart.get('speedseries');
                speedAvgSeries = self.multiChart.get('speedavgseries');
                lapAvgSpeedSeries = self.multiChart.get('LAP_avg_speed');
                lapMaxSpeedSeries = self.multiChart.get('LAP_max_speed');
                startTimestamp = self.multiChart.xAxis[0].min - timezoneDiff;
                endTimestamp = self.multiChart.xAxis[0].max - timezoneDiff;

            }

            if (speedSeries) {
                if (forceSpeedKMprH) {
                    self.masterVM.previousSpeedMode = self.masterVM.speedMode();
                    self.masterVM.previousSpeedData = speedSeries.data;
                    self.masterVM.previousSpeedAvgData = speedAvgSeries.data;

                    speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, 'speedseries');

                    if (lapAvgSpeedSeries && lapMaxSpeedSeries) {
                        updatePoint(lapAvgSpeedSeries.data, "avg_speed", FITViewUIConverter.convertSpeedToKMprH);
                        updatePoint(lapMaxSpeedSeries.data, "max_speed", FITViewUIConverter.convertSpeedToKMprH);
                        self.multiChart.redraw();
                    }

                    if (self.masterVM.settingsVM.requestAveragingOnSpeed())
                        speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, 'speedavgseries', true, self.masterVM.settingsVM.averageSampleTime());

                    self.masterVM.speedMode(2);

                } else {
                    self.masterVM.speedMode(self.masterVM.previousSpeedMode);
                    if (self.masterVM.previousSpeedMode === FITSport.running) // Running 
                    {
                        speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToMinPrKM, 'speedseries');

                        if (lapAvgSpeedSeries && lapMaxSpeedSeries) {
                            updatePoint(lapAvgSpeedSeries.data, "avg_speed", FITViewUIConverter.convertSpeedToMinPrKM);
                            updatePoint(lapMaxSpeedSeries.data, "max_speed", FITViewUIConverter.convertSpeedToMinPrKM);
                            self.multiChart.redraw();
                        }
                        if (self.masterVM.settingsVM.requestAveragingOnSpeed)
                            speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToMinPrKM, 'speedavgseries', true, self.masterVM.settingsVM.averageSampleTime());
                    } else {
                        speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, 'speedseries');
                        if (self.masterVM.settingsVM.requestAveragingOnSpeed)
                            speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, 'speedavgseries', true, self.masterVM.settingsVM.averageSampleTime());

                        if (lapAvgSpeedSeries && lapMaxSpeedSeries) {
                            updatePoint(lapAvgSpeedSeries.data, "avg_speed", FITViewUIConverter.convertSpeedToKMprH);
                            updatePoint(lapMaxSpeedSeries.data, "max_speed", FITViewUIConverter.convertSpeedToKMprH);
                            self.multiChart.redraw();
                        }
                    }
                }

                // Toggle lap lines - to update speed 
                if (self.masterVM.settingsVM.showLapLines()) {

                    self.masterVM.settingsVM.showLapLines(false);
                    self.masterVM.settingsVM.showLapLines(true);
                }

                speedSeries.setData(speedSeriesData, !self.masterVM.settingsVM.requestAveragingOnSpeed());
                if (self.masterVM.settingsVM.requestAveragingOnSpeed())
                    speedAvgSeries.setData(speedAvgSeriesData, true);
            }
        },

        addLapLines: function (rawData, chart) {
            // Add lap plotlines
            //
            // Would like to have the ability to write images at bottom/top of plotlines (to show lap triggers),
            // but label property doesnt support image. In the case line is rendered using SVG
            // line coordinates can be accessed via FITUI.multiChart.xAxis[0].plotLinesAndBands[0].svgElem.d

            //var self = this;

            var axis = chart.get(rawdataxAxis);

            var lapLinesConfig = [];

            var lapLabel;
            var lapNr;
            var len;

            if (rawData.lap) {
                len = rawData.lap.timestamp.length;
                for (lapNr = 0 ; lapNr < len; lapNr++) {
                    if (rawData.lap.timestamp && rawData.lap.timestamp[lapNr]) {
                        switch (rawData.lap.lap_trigger[lapNr]) {
                            case lap_trigger.manual:  // LAP pressed
                            case lap_trigger.distance: // Distance
                            case lap_trigger.session_end: // Session end
                                lapLabel = "";


                                if (rawData.lap.avg_speed && rawData.lap.avg_speed[lapNr]) {
                                    switch (this.masterVM.speedMode()) {
                                        case FITSport.running: // Running
                                            lapLabel += " " + FITViewUIConverter.formatToMMSS(FITViewUIConverter.convertSpeedToMinPrKM(rawData.lap.avg_speed[lapNr]));
                                            break;
                                        case FITSport.cycling: // Cycling
                                            lapLabel += " " + FITViewUIConverter.convertSpeedToKMprH(rawData.lap.avg_speed[lapNr]).toFixed(1);
                                            break;

                                        default:
                                            lapLabel += " " + FITViewUIConverter.convertSpeedToKMprH(rawData.lap.avg_speed[lapNr]).toFixed(1);
                                            break;
                                    }
                                }

                                //var distance;
                                //if (rawData.lap.total_distance && rawData.lap.total_distance[lapNr]) {
                                //    distance = Math.round(rawData.lap.total_distance[lapNr]);
                                //    if (!(distance === 1000 || distance === 1609))
                                //        lapLabel += "<br/>" + distance.toString()+" m";
                                //}
                                break;
                            default:
                                lapLabel = null;
                                break;
                        }

                    } else
                        self.loggMessage("warn","No timestamps for lap in rawdata to lay out lap lines");

                    lapLinesConfig[lapNr] = {
                        id: 'plotLines', // + lapNr.toString(), - having the same id allows removal of all lines at once 

                        dashStyle: 'Dash',
                        //color: '#960000',
                        color: 'lightgray',
                        width: 1,
                        label: {

                            rotation: 0,
                            text: lapLabel,
                            textAlign: 'right',
                            verticalAlign: 'top',
                            x: -5,
                            y: 15,
                            style: {
                                fontSize: '9px',
                                fontWeight: 'bold'
                            }

                        },
                        value: FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawData.lap.timestamp[lapNr])
                    };
                }
            }

            for (lapNr = 0; lapNr < lapLinesConfig.length; lapNr++) {
                axis.addPlotLine(lapLinesConfig[lapNr]);
            }

        },

        // Handles display of measurements in several graphs with multiple axis
        showMultiChart: function (rawData, startTimestamp, endTimestamp, sport) {

            // Clean up previous chart
            // http://api.highcharts.com/highcharts#Chart.destroy()
            if (this.multiChart)
                this.multiChart.destroy();

            var chartId = "multiChart";
            var divChart = document.getElementById(chartId);
            divChart.style.visibility = "visible";
            var seriesSetup = []; // Options name,id
            var seriesData = []; // Actual data in chart
            var heartRateSeriesOptions;
            var heartRateSeriesData;
            var altitudeSeries;
            var altitudeSeriesData;
            var speedSeries;
            var speedSeriesData;
            var speedAvgSeries;
            var speedAvgSeriesData;

            var cadenceSeries;
            var cadenceSeriesData;
            var powerSeries;
            var powerSeriesData;
            var temperatureSeries;
            var temperatureSeriesData;

            var prevMarker = null; // Holds previous marker for tracking position during mouse move/over

            var allRawdata = rawData;

            // Record data

            var yAxisNr = 0; // Give each series a new y-axis
            var yAxisOptions = [];
            var speedYAxisNr;
            var heartRateYAxisNr;

            var id;

            var timezoneDiff;

            if (FITUtil.isUndefined(rawData.record))
                self.loggMessage("error","No rawdata present on rawdata.record, cannot render chart");
            else
                if (FITUtil.isEmpty(rawData.record))
                    self.loggMessage("warn","Empty rawdata on rawdata.record, nothing to render in chart");

            if (rawData.record) {
                if (rawData.record.heart_rate) {
                    id = 'heartrateseries';
                    heartRateSeriesData = FITUtil.combine(rawData, rawData.record.heart_rate, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                    seriesData[id] = heartRateSeriesData;
                    heartRateYAxisNr = yAxisNr;
                    heartRateSeriesOptions = {
                        id: id,
                        name: 'Heart rate',
                        yAxis: yAxisNr++,
                        type: 'line',
                        data: seriesData[id],
                        zIndex: 100,
                    };
                    seriesSetup.push(heartRateSeriesOptions);
                    yAxisOptions.push({
                        gridLineWidth: 1,
                        title: {
                            text: 'Heart rate'
                        }

                    });

                }

                this.masterVM.speedMode(undefined);

                if (rawData.record.speed) {
                    id = 'speedseries';

                    if (self.masterVM.settingsVM.forceSpeedKMprH())
                        sport = FITSport.generic;

                    switch (sport) {
                        case FITSport.running: // Running
                            this.masterVM.speedMode(1); // min/km
                            speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToMinPrKM, id, false);
                            break;
                        case FITSport.cycling: // Cycling
                            this.masterVM.speedMode(2); // km/h
                            speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, id, false);
                            break;
                        default:
                            this.masterVM.speedMode(2);
                            speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, id, false);
                            break;
                    }

                    seriesData[id] = speedSeriesData;
                    speedYAxisNr = yAxisNr;
                    speedSeries = { name: 'Speed', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex: 99 };
                    seriesSetup.push(speedSeries);
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        title: {
                            text: 'Speed'
                        },
                        opposite: true,


                    });
                }

                var avgReq = this.masterVM.settingsVM.requestAveragingOnSpeed();
                if (rawData.record.speed && avgReq) {
                    id = 'speedavgseries';

                    if (self.masterVM.settingsVM.forceSpeedKMprH())
                        sport = FITSport.generic;

                    var avgSampleInterval = this.masterVM.settingsVM.averageSampleTime();

                    switch (sport) {
                        case FITSport.running: // Running
                            this.masterVM.speedMode(1); // min/km
                            speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToMinPrKM, id, avgReq, avgSampleInterval);
                            break;
                        case FITSport.cycling: // Cycling
                            this.masterVM.speedMode(2); // km/h
                            speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, id, avgReq, avgSampleInterval);
                            break;
                        default:
                            this.masterVM.speedMode(2);
                            speedAvgSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITViewUIConverter.convertSpeedToKMprH, id, avgReq, avgSampleInterval);
                            break;
                    }
                    seriesData[id] = speedAvgSeriesData;
                    //speedYAxisNr = yAxisNr;
                    speedAvgSeries = { name: 'SpeedAvg', id: id, yAxis: speedYAxisNr, data: seriesData[id], type: 'spline', visible: FITUtil.hasGPSData(rawData), zIndex: 99 };
                    seriesSetup.push(speedAvgSeries);
                    //yAxisOptions.push({
                    //    gridLineWidth: 0,
                    //    title: {
                    //        text: null
                    //    },
                    //    opposite: true,


                    //});
                }

                if (rawData.record.power) {
                    id = 'powerseries';
                    powerSeriesData = FITUtil.combine(rawData, rawData.record.power, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                    seriesData[id] = powerSeriesData;

                    powerSeries = { name: 'Power', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex: 98, visible: false };
                    seriesSetup.push(powerSeries);
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        title: {
                            text: 'Power'
                        },
                        opposite: true,
                    });
                }

                if (rawData.record.cadence) {
                    id = 'cadenceseries';
                    cadenceSeriesData = FITUtil.combine(rawData, rawData.record.cadence, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                    seriesData[id] = cadenceSeriesData;

                    cadenceSeries = { name: 'Cadence', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', visible: false, zIndex: 97 };

                    seriesSetup.push(cadenceSeries);
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        title: {
                            text: 'Cadence'
                        }

                    });

                }

                if (rawData.record.altitude) {
                    id = 'altitudeseries';
                    altitudeSeriesData = FITUtil.combine(rawData, rawData.record.altitude, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                    seriesData[id] = altitudeSeriesData;
                    var hasGPSdata = FITUtil.hasGPSData(rawData);
                    altitudeSeries = {
                        name: 'Altitude', id: id, yAxis: yAxisNr++, data: seriesData[id], visible: false, type: 'line', zIndex: 96
                    };

                    seriesSetup.push(altitudeSeries);
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        title: {
                            text: 'Altitude'
                        }

                    });
                }


                if (rawData.record.temperature) {
                    id = 'temperatureseries';
                    temperatureSeriesData = FITUtil.combine(rawData, rawData.record.temperature, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                    seriesData[id] = temperatureSeriesData;
                    temperatureSeries = { name: 'Temperature', id: id, yAxis: yAxisNr++, data: seriesData[id], visible: false, type: 'line', zIndex: 95 };
                    seriesSetup.push(temperatureSeries);
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        opposite: true,
                        title: {
                            text: 'Temperature'
                        }
                    });
                }



                var speedVSHR = FITUtil.combineTwo(speedSeriesData, heartRateSeriesData);
                if (speedVSHR) {
                    id = 'speedVSHR';
                    seriesData[id] = speedVSHR;
                    seriesSetup.push({ name: 'Speed vs HR', id: id, xAxis: 2, yAxis: heartRateYAxisNr, data: seriesData[id], type: 'scatter', visible: false, zIndex: 94 });
                }
            }
            //yAxisOptions.push({
            //    gridLineWidth: 0,
            //    type : 'scatter',
            //    title: {
            //        text: 'HR!'
            //    }


            //});

            //this.scatterChart = new Highcharts.Chart({
            //    chart: {
            //        renderTo: 'scatterChart',
            //        //type: 'scatter'
            //    },
            //    //plotOptions: {
            //    //    scatter: {
            //    //        marker: {
            //    //            radius: 5,
            //    //            states: {
            //    //                hover: {
            //    //                    enabled: true,
            //    //                    lineColor: 'rgb(100,100,100)'
            //    //                }
            //    //            }
            //    //        }
            //    //    }
            //    //},

            //    title: {
            //        text: ''
            //    },
            //    //yAxis: [{
            //    //    type : 'scatter'}],
            //    xAxis: [{
            //        id: combinedxAxisID
            //    }],
            //    series : [{
            //        name: 'Speed vs HR',
            //        type : 'scatter',
            //        //color: 'rgba(223, 83, 83, .5)',
            //        data: arr
            //    }]

            //});

            var lap = {
                categories: [],
                avg_speed: [],
                max_speed: [],
                avg_heart_rate: [],
                max_heart_rate: []
            };

            self.masterVM.tickPositions = [];  // Tick at end of each lap
            self.masterVM.distanceAtTick = {};    // Fetches rawdata.record distance at specific timestamp
            var lapIndexTimestamp; // Index of timestamp for current lap in rawdata.record.timestamp

            // Setup lap categories
            if (rawData.lap) {
                var len = rawData.lap.timestamp.length;


                var lapNr;

                var pushData = function (property, converter) {

                    if (rawData.lap[property] && rawData.lap[property][lapNr]) {

                        if (converter)
                            lap[property].push(converter(rawData.lap[property][lapNr]));
                        else
                            lap[property].push(rawData.lap[property][lapNr]);

                        return lap[property];
                    }
                    else {

                        self.loggMessage("warn","Found no lap." + property + " in rawdata");
                        return undefined;
                    }
                };

                for (lapNr = 0; lapNr < len; lapNr++) {

                    if (rawData.lap.start_time[lapNr] >= startTimestamp && rawData.lap.timestamp[lapNr] <= endTimestamp) {
                        lap.categories.push((lapNr + 1).toString());

                        switch (sport) {

                            case FITSport.running: // Running
                                pushData("avg_speed", FITViewUIConverter.convertSpeedToMinPrKM);
                                pushData("max_speed", FITViewUIConverter.convertSpeedToMinPrKM);
                                pushData("avg_heart_rate");
                                pushData("max_heart_rate");
                                break;

                            case FITSport.cycling: // Cycling
                                pushData("avg_speed", FITViewUIConverter.convertSpeedToKMprH);
                                pushData("max_speed", FITViewUIConverter.convertSpeedToKMprH);
                                pushData("avg_heart_rate");
                                pushData("max_heart_rate");
                                break;

                            default:
                                pushData("avg_speed", FITViewUIConverter.convertSpeedToKMprH);
                                pushData("max_speed", FITViewUIConverter.convertSpeedToKMprH);
                                pushData("avg_heart_rate");
                                pushData("max_heart_rate");
                                break;
                        }

                        lapIndexTimestamp = FITUtil.getIndexOfTimestamp(rawData.record, rawData.lap.timestamp[lapNr]);
                        if (lapIndexTimestamp !== -1 && rawData.record.distance && rawData.record.distance[lapIndexTimestamp])
                            self.masterVM.distanceAtTick[FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawData.lap.timestamp[lapNr])] = rawData.record.distance[lapIndexTimestamp];
                        else
                            self.loggMessage("warn", "Could not find distance at tick for lap end time UTC = ", rawData.lap.timestamp[lapNr]);

                        self.masterVM.tickPositions.push(FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawData.lap.timestamp[lapNr]));
                    }
                }

                // in case of empty rawdata, but lap data available
                if (typeof (heartRateYAxisNr) === "undefined" && ((lap.avg_heart_rate && lap.avg_heart_rate.length > 0) || (lap.max_heart_rate && lap.max_heart_rate.length > 0))) {

                    yAxisOptions.push({
                        gridLineWidth: 1,
                        title: {
                            text: 'Heart rate'
                        }
                    });

                    heartRateYAxisNr = yAxisNr;
                  
                }

                if (typeof (speedYAxisNr) === "undefined" && ((lap.avg_speed && lap.avg_speed.length > 0) || (lap.max_speed && lap.max_speed.length > 0))) {

                    yAxisOptions.push({
                        gridLineWidth: 1,
                        title: {
                            text: 'Speed'
                        }
                    });

                    speedYAxisNr = yAxisNr++;
                }

                if (lap.avg_speed && lap.avg_speed.length > 0) 
                    seriesSetup.push({ name: "Avg. speed", id: 'LAP_avg_speed', xAxis: 1, yAxis: speedYAxisNr, data: lap.avg_speed, type: 'column', visible: false, zIndex: 1 });

                if (lap.max_speed && lap.max_speed.length > 0)
                    seriesSetup.push({ name: "Max. speed", id: 'LAP_max_speed', xAxis: 1, yAxis: speedYAxisNr, data: lap.max_speed, type: 'column', visible: false, zIndex: 1 });

                if (lap.avg_heart_rate && lap.avg_heart_rate.length > 0)
                    seriesSetup.push({ name: "Avg. HR", id: 'LAP_avg_heart_rate', xAxis: 1, yAxis: heartRateYAxisNr, data: lap.avg_heart_rate, type: 'column', visible: false, zIndex: 1 });

                if (lap.max_heart_rate && lap.max_heart_rate.length > 0)
                    seriesSetup.push({ name: "Max. HR", id: 'LAP max_heart_rate', xAxis: 1, yAxis: heartRateYAxisNr, data: lap.max_heart_rate, type: 'column', visible: false, zIndex: 1 });
            }
            else
                self.loggMessage("warn","No lap data present on rawdata.lap, tried to set up lap chart for avg/max speed/HR etc.");

            // HRV

            if (rawData.hrv !== undefined) {
                if (rawData.hrv.time !== undefined) {

                    seriesSetup.push({ name: 'HRV', id: 'HRV', xAxis: 3, yAxis: yAxisNr++, data: rawData.hrv.time, visible: false, type: 'scatter' });
                    yAxisOptions.push({
                        gridLineWidth: 0,
                        opposite: true,
                        title: {
                            text: 'Heart Rate Variability'
                        }
                    });
                }

            }

            var xAxisType = 'datetime';

            var chartOptions = {
                animation: false,
                renderTo: chartId,

                // Allow zooming
                zoomType: 'xy',
                events: {
                    redraw: function () {

                        // Use events instead?? -> send event "redraw" to these
                        if (self.masterVM.settingsVM.showLapTriggers())
                            self.showLapTriggers(rawData);  // hook up - we want to synchronize on window resize

                        if (self.masterVM.settingsVM.showEvents())
                            self.showEvents(rawData);

                        if (self.masterVM.settingsVM.showDeviceInfo())
                            self.showDeviceInfo(rawData);


                    }
                }
                //marginBottom: 120,
                //marginTop:50

            };
            //if (rawData.hrv !== undefined)
            //    chartOptions.inverted = true;

            var d = new Date();
            self.loggMessage("log","Starting multichart setup now " + d);


            // Shared mouse event handler for spline/line series in multichart
            var mouseHandler =
                {
                    select: function () {
                        self.loggMessage("log",(Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x), this.y));
                    },

                    mouseOut: function () {
                        if (prevMarker !== undefined && prevMarker !== null) {
                            prevMarker.setMap(null);
                            prevMarker = null; // GC takes over...
                        }
                    },

                    mouseOver: function () {

                        //var lapxAxis = self.multiChart.get(lapxAxisID);
                        //if (this.series.xAxis === lapxAxis)
                        //    return;

                        var lat, long;

                        function setMarker() {
                            if (FITUtil.isUndefined(google)) // Allows working without map
                                return;

                            prevMarker = new google.maps.Marker({
                                position: new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(lat), FITUtil.timestampUtil.semiCirclesToDegrees(long)),
                                icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 3
                                },
                                draggable: true,
                                map: self.map
                            });
                        }

                       
                        if (rawData.record !== undefined) {

                            var index = rawData.record.timestamp.indexOf(this.x - FITUtil.timestampUtil.getTimezoneOffsetFromUTC());


                            if (index === -1) {
                                self.loggMessage("error","Could not find index of timestamp ", this.x);
                                return;
                            }

                            if (rawData.record.position_lat !== undefined)
                                lat = rawData.record.position_lat[index];

                            if (rawData.record.position_long !== undefined)
                                long = rawData.record.position_long[index];

                            //console.log("Lat, long ", lat, long);

                            if (lat && long) {
                                if (prevMarker === null) {
                                    setMarker();
                                } else {
                                    // Clear previous marker
                                    prevMarker.setMap(null);
                                    prevMarker = null;
                                    setMarker();
                                }
                            }

                        }
                    }
                };

            this.multiChart = new Highcharts.Chart({
                chart: chartOptions,
                //height : 700,

                title: {
                    text: ''
                },

                xAxis: [{
                    id: rawdataxAxis,
                    type: xAxisType, // datetime
                    events: {
                        afterSetExtremes: function (event) {
                            // Callback after zoom out, Highcharts uses a jquery event mechanism with event.min/max === undefined for axes != datetime
                            if (event.max && event.min) {
                                // Remember x-axis is local time, but rawdata is accessed by UTC
                                // Highchart "reset zoom"-button fires here with values on event.min/max (setExtremes gave undefined)
                                timezoneDiff = FITUtil.timestampUtil.getTimezoneOffsetFromUTC();
                                //console.log("afterSetExtremes xAxis in multiChart min, max =  ", event.min, event.max);
                                var startTimestampUTC = Math.round(event.min) - timezoneDiff;
                                var endTimestampUTC = Math.round(event.max) - timezoneDiff;
                                self.showHRZones(allRawdata, startTimestampUTC, endTimestampUTC);
                            }
                        }

                        //setExtremes: function (event) {
                        //    console.log("setExtremes xAxis in multiChart min, max =  ", event.min, event.max);
                        //}
                    },
                    //tickPositions: self.masterVM.tickPositions,
                    tickPositioner: function () {
               
                        // Copy array of tickpositions -> due to Highchart library for some reason deletes labels when zooming out again...
                        var tickPositions = [];
                        var len = self.masterVM.tickPositions.length;
                        for (var posNr=0; posNr < len; posNr++)
                            tickPositions.push(self.masterVM.tickPositions[posNr]);

                        return tickPositions;
                    },
                    //dateTimeLabelFormats: {
                    //    day: '%e of %b'
                    //},
                    labels: {
                        formatter: function () {
                            // return Highcharts.dateFormat('%H:%M:%S', this.value);
                            var distanceKm;
                            if (self.masterVM.settingsVM.distanceOnXAxis() && self.masterVM.distanceAtTick[this.value]) {
                                distanceKm = self.masterVM.distanceAtTick[this.value] / 1000;
                                if (distanceKm < 1)
                                    return self.masterVM.distanceAtTick[this.value] + ' m';
                                else
                                    return distanceKm.toFixed(0) +' km';
                            }
                            else
                                return Highcharts.dateFormat('%H:%M:%S', this.value);
                        }
                    },
                    //plotLines: lapLinesConfig
                    //reversed : true
                }, {
                    id: lapxAxisID,
                    categories: lap.categories // for each lap avg/max speed/HR
                }, {
                    id: combinedxAxisID
                },
                { id: hrvxAxisID }
                ],

                yAxis: yAxisOptions,

                legend: {
                    enabled: this.masterVM.settingsVM.showLegends()
                },
                // Shared tooltip for all series - maybe split this for each series type ...
                tooltip: {
                    //xDateFormat: '%Y-%m-%d',
                    formatter:

                        function () {

                            //http://stackoverflow.com/questions/3885817/how-to-check-if-a-number-is-float-or-integer
                            function isInt(n) {
                                return n % 1 === 0;
                            }

                            var speed, s;

                            var onLapxAxis;
                            var onSpeedVSHRxAxis;
                            var onHrvxAxis;

                            onLapxAxis = (this.series.xAxis === self.multiChart.get(lapxAxisID));
                            onSpeedVSHRxAxis = (this.series.xAxis === self.multiChart.get(combinedxAxisID));
                            onHrvxAxis = (this.series.xAxis === self.multiChart.get(hrvxAxisID));

                            // Check to see if its a tooltip for lap axis
                            if (onLapxAxis) {
                                var lapNr = this.x;
                                s = "Lap " + lapNr.toString();
                                if (rawData.lap.total_distance)
                                    s += '<br/>' + '<b>Distance:</b> ' + Highcharts.numberFormat(rawData.lap.total_distance[lapNr - 1], 0) + ' m';
                            }

                            else if (onSpeedVSHRxAxis) {
                                s = "<b>Heart rate:</b>" + this.y;
                            }
                            else if (onHrvxAxis) {
                                s = '<b>RR time :</b>' + Highcharts.numberFormat(this.y, 3) + " s"; // Hrv time in seconds 0.xxx
                            }
                            else
                                s = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x);

                            // Special treatment for speed
                            if (self.masterVM.speedMode() && this.series.name === "Speed" || this.series.name === "Avg. speed" || this.series.name === "Max. speed" || this.series.name === "SpeedAvg" || this.series.name === "Speed vs HR") {
                                if (this.series.name === "Speed vs HR") {
                                    speed = this.x; // Speed is on the x-axis for this chart....
                                    s += '<br/><b>Speed</b>: ';
                                } else {
                                    s += '<br/>' + '<b>' + this.series.name + '</b>' + ': ';
                                    speed = this.y;
                                }

                                switch (self.masterVM.speedMode()) {
                                    case FITSport.running: // Running
                                        s += FITViewUIConverter.formatToMMSS(speed) + " min/km";
                                        break;
                                    case FITSport.cycling: // Cycling
                                        s += Highcharts.numberFormat(speed, 1) + " km/h";
                                        break;
                                    default:
                                        s += Highcharts.numberFormat(speed, 1) + " km/h";
                                        break;
                                }
                            }
                            else if (this.series.name !== 'HRV') {
                                s += '<br/><b>' + this.series.name + '</b>: ';
                                if (isInt(this.y))
                                    s += this.y.toString();
                                else
                                    s += Highcharts.numberFormat(this.y, 1);
                            }

                            return s;

                        },

                    crosshairs: true
                },

                plotOptions: {

                    // Generic options in series: - had an issue where scatter series disappeared because marked was not enabled  //
                    spline: {
                        marker: {
                            enabled: false,  // Will speed up drawing, no need to call drawPoints in Highcharts....for entire series
                            states: {
                                hover: {
                                    enabled: true
                                }
                            }
                        },

                        point: {

                            events: {

                                select: mouseHandler.select,

                                mouseOver: mouseHandler.mouseOver,

                                mouseOut: mouseHandler.mouseOut
                            }

                        }
                    },

                    line: {

                        marker: {
                            enabled: false,  // Will speed up drawing, no need to call drawPoints in Highcharts....for entire series
                            states: {
                                hover: {
                                    enabled: true
                                }
                            }
                        },

                        animation: false,

                        allowPointSelect: true,

                        point: {

                            events: {

                                select: mouseHandler.select,

                                mouseOver: mouseHandler.mouseOver,

                                mouseOut: mouseHandler.mouseOut
                            }

                        }
                    }
                },

                series: seriesSetup

            }
                //, function () {
                ////callback action
                //alert('Something is happening now....');
        //    }
        );

            //var divLoadingId = '#liLoad';
            //var jquerydivLoadingElement = $(divLoadingId);
            //var divLoadingElement = jquerydivLoadingElement[0];
            //console.log(divLoadingId + " for data binding ", divLoadingElement);

            //if (FITUI.loadChartVM === undefined) {

            //    //FITUI.masterVM.loadChartVM = new loadSeriesViaButtonViewModel(FITUI.multiChart, seriesData);
            //   // ko.applyBindings(FITUI.loadChartVM, divLoadingElement);

            //} else

            //jquerydivLoadingElement.show();

            //self.masterVM.loadChartVM.setNewChartAndSeriesData(self.multiChart, seriesData);

            if (self.masterVM.settingsVM.showLapLines())
                self.addLapLines(rawData, self.multiChart, false);

            d = new Date();
            self.loggMessage("log","Finishing multichart setup now " + d);
        },

        // Shows info about devices used during an activty
        showDeviceInfo: function (rawdata) {


            var device_type = {
                antfs: 1,
                bike_power: 11,
                environment_sensor_legacy: 12,
                multi_sport_speed_distance: 15,
                control: 16,
                fitness_equipment: 17,
                blood_pressure: 18,
                geocache_node: 19,
                light_electric_vehicle: 20,
                env_sensor: 25,
                weight_scale: 119,
                heart_rate: 120,
                bike_speed_cadence: 121,
                bike_cadence: 122,
                bike_speed: 123,
                stride_speed_distance: 124
            };

            var garmin_product = {
                hrm1: 1,
                axh01: 2, // AXH01 HRM chipset
                axb01: 3,
                axb02: 4,
                hrm2ss: 5,
                dsi_alf02: 6,
                fr405: 717,
                fr50: 782,
                fr60: 988,
                dsi_alf01: 1011,
                fr310xt: 1018,
                edge500: 1036,
                fr110: 1124,
                edge800: 1169,
                chirp: 1253,
                edge200: 1325,
                fr910xt: 1328,
                alf04: 1341,
                fr610: 1345,
                fr70: 1436,
                fr310xt_4t: 1446,
                amx: 1461,
                sdm4: 10007, // SDM4 footpod
                training_center: 20119,
                connect: 65534 // Garmin Connect website
            };

            var manufacturer = {
                garmin: 1
            };

            if (FITUtil.isUndefined(rawdata)) {
                self.loggMessage("error","No rawdata available");
                return;
            }

            if (FITUtil.isUndefined(rawdata.device_info)) {
                self.loggMessage("error","No device information on rawdata.device_info");
                return;
            }

            var deviceInfoLen = rawdata.device_info.timestamp.length;

            if (FITUtil.isUndefined(deviceInfoLen) || deviceInfoLen === 0) {
                self.loggMessage("error","No timestamp information in device_info, device_info.timestamp");
                return;
            }

            var xpos, ypos;
            var srcImgDeviceInfo, titleDeviceInfo;
            var SVGDeviceInfoElement;
            var previousTimestamp;

            var plotLeft = this.multiChart.plotLeft;
            var renderer = this.multiChart.renderer;
            var xaxis = this.multiChart.get(rawdataxAxis);

            var width = xaxis.width;
            //var extremes = this.multiChart.xAxis[0].getExtremes();
            var max = xaxis.max;
            var min = xaxis.min;

            if (typeof max === "undefined" || typeof min === "undefined") {
                self.loggMessage("log", "Max/Min of axis is undefined, cannot show device/sensor info.");
                return;
            }

            self.loggMessage("log","Deviceinfo xaxis extreemes datamin,datamax : ", min, max);

            this.removeSVGGroup(this.masterVM.deviceInfoGroup);
            this.masterVM.deviceInfoGroup = renderer.g('deviceinfo').add();


            var type, manufact, product;

            if (FITUtil.isUndefined(this.masterVM.freeYPOS))
                this.masterVM.freeYPOS = {};

            var waitForDelay = 3 * 60 * 1000;

            var recLen = rawdata.record.timestamp.length;
            var maxTimestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);

            for (var deviceInfoNr = 0; deviceInfoNr < deviceInfoLen; deviceInfoNr++) {
                var timestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.device_info.timestamp[deviceInfoNr]);

                if (timestamp < min)
                    continue;

                if (timestamp > maxTimestamp + waitForDelay || timestamp > max)
                    break;


                if (timestamp <= max && timestamp >= min)
                    xpos = Math.round(width * ((timestamp - min) / (max - min))) + plotLeft;
                else {
                    xpos = width + plotLeft - 5;  // Move device info. that reaches beyond max down at end 
                    timestamp = max;

                }

                if (this.masterVM.freeYPOS[timestamp] >= 0)
                    this.masterVM.freeYPOS[timestamp] += 20;
                else
                    this.masterVM.freeYPOS[timestamp] = 0;

                type = undefined;
                if (rawdata.device_info.device_type)
                    type = rawdata.device_info.device_type[deviceInfoNr];

                manufact = undefined;
                if (rawdata.device_info.manufacturer)
                    manufact = rawdata.device_info.manufacturer[deviceInfoNr];

                product = undefined;
                if (rawdata.device_info.product)
                    product = rawdata.device_info.product[deviceInfoNr];

                // Just in case we don't get a hit in the if's
                srcImgDeviceInfo = "Images/deviceinfo/unknown.png";
                titleDeviceInfo = "";
                if (manufact === manufacturer.garmin)
                    titleDeviceInfo = "Manufacturer : Garmin";
                else if (manufact)
                    titleDeviceInfo = "Manufacturer : " + manufact.toString();
                if (product)
                    titleDeviceInfo = titleDeviceInfo + " Product :" + product.toString();
                if (type)
                    titleDeviceInfo = titleDeviceInfo + " Type: " + type.toString();

                if (type === device_type.antfs && manufact === manufacturer.garmin) {
                    switch (product) {
                        // Running/multisport

                        case garmin_product.fr910xt:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/910xt.png";
                            titleDeviceInfo = "910XT";
                            break;

                        case garmin_product.fr610:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/fr610.png";
                            titleDeviceInfo = "FR610";
                            break;

                        case garmin_product.fr310xt:
                        case garmin_product.fr310xt_4t:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/310xt.jpg";
                            titleDeviceInfo = "FR310XT";
                            break;

                        case garmin_product.fr405:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/405.jpg";
                            titleDeviceInfo = "FR405";
                            break;

                        case garmin_product.fr110:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/fr110.png";
                            titleDeviceInfo = "FR110";
                            break;

                        //case garmin_product.fr210:
                        //    srcImgDeviceInfo = "Images/deviceinfo/garmin/fr210.jpg";
                        //    titleDeviceInfo = "FR210";
                        //    break;

                        case garmin_product.fr70:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/fr70.jpg";
                            titleDeviceInfo = "FR70";
                            break;

                        case garmin_product.fr60:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/fr60.jpg";
                            titleDeviceInfo = "FR60";
                            break;


                        case garmin_product.fr50:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/fr50.jpg";
                            titleDeviceInfo = "FR50";
                            break;

                            // Cycling
                        case garmin_product.edge800:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/edge800.jpg";
                            titleDeviceInfo = "EDGE 800";
                            break;

                        case garmin_product.edge500:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/edge500.jpg";
                            titleDeviceInfo = "EDGE 500";
                            break;

                        case garmin_product.edge200:
                            srcImgDeviceInfo = "Images/deviceinfo/garmin/edge200.jpg";
                            titleDeviceInfo = "EDGE 200";
                            break;

                         default:
                             srcImgDeviceInfo = "Images/deviceinfo/unknown.jpg";
                             titleDeviceInfo = "Product :" + product.toString();
                             break;
                    }
                }

                if (type === device_type.heart_rate) {
                    srcImgDeviceInfo = "Images/deviceinfo/HRM.jpg";
                    titleDeviceInfo = "Heart rate monitor";
                }

                if (type === device_type.environment_sensor_legacy && manufact === manufacturer.garmin && product === 1080) {
                    srcImgDeviceInfo = "Images/deviceinfo/env_sensor_legacy.png";
                    titleDeviceInfo = "GPS/SIRF";
                    
                }

                if (type === device_type.bike_speed_cadence) {
                    srcImgDeviceInfo = "Images/deviceinfo/garmin/gsc-10.jpg";
                    titleDeviceInfo = "Bike speed/cadence sensor";
                   
                }

                if (type === device_type.stride_speed_distance) {
                    srcImgDeviceInfo = "Images/deviceinfo/garmin/footpod.jpg";
                    titleDeviceInfo = "Footpod (stride/speed/distance)";
                   
                }

                if (type === device_type.bike_power) {
                    srcImgDeviceInfo = "Images/power.png";
                    titleDeviceInfo = "Bike power";
                }

                if (type === device_type.environment_sensor_legacy && FITUtil.isUndefined(product) && FITUtil.isUndefined(manufact)) {
                    srcImgDeviceInfo = "Images/deviceinfo/env_sensor_legacy.png";
                    titleDeviceInfo = "Barometre/Temperature sensor";
                }

                if (type === device_type.environment_sensor_legacy && FITUtil.isUndefined(product) && manufact === manufacturer.garmin) {
                    srcImgDeviceInfo = "Images/deviceinfo/env_sensor_legacy.png";
                    titleDeviceInfo = "Accelerometre";
                }

                titleDeviceInfo += " ";
                if (rawdata.device_info.software_version[deviceInfoNr]) {
                    titleDeviceInfo += "Firmware : " + rawdata.device_info.software_version[deviceInfoNr].toString();
                }

                if (rawdata.device_info.serial_number[deviceInfoNr]) {
                    titleDeviceInfo += " Serial number : " + rawdata.device_info.serial_number[deviceInfoNr].toString();
                }

                titleDeviceInfo += " @ " + Highcharts.dateFormat('%H:%M:%S', timestamp);

                if (srcImgDeviceInfo !== undefined) {
                    SVGDeviceInfoElement = renderer.image(srcImgDeviceInfo, xpos, this.masterVM.freeYPOS[timestamp], 16, 16).add(this.masterVM.deviceInfoGroup);
                    if (titleDeviceInfo)
                        SVGDeviceInfoElement.attr({ title: titleDeviceInfo });
                    srcImgDeviceInfo = undefined;
                    titleDeviceInfo = undefined;
                }

                previousTimestamp = timestamp;
            }


        },

        showEvents: function (rawdata) {
            var event_type = {
                start: 0,
                stop: 1,
                consecutive_depreciated: 2,
                marker: 3,
                stop_all: 4,
                begin_depreciated: 5,
                end_depreciated: 6,
                end_all_depreciated: 7,
                stop_disable: 8,
                stop_disable_all: 9
            };


            var event = {
                timer: 0, // Group 0. Start / stop_all
                workout: 3, //  start / stop
                workout_step: 4, //  Start at beginning of workout. Stop at end of each step.
                power_down: 5, // stop_all group 0
                power_up: 6, //  stop_all group 0
                off_course: 7, // start / stop group 0
                session: 8, // Stop at end of each session.
                lap: 9, //  Stop at end of each lap.
                course_point: 10, // marker.
                battery: 11, // marker.
                virtual_partner_pace: 12, //  Group 1. Start at beginning of activity if VP enabled, when VP pace is changed during activity or VP enabled mid activity. stop_disable when VP disabled.
                hr_high_alert: 13, // Group 0. Start / stop when in alert condition.
                hr_low_alert: 14, //  Group 0. Start / stop when in alert condition.
                speed_high_alert: 15, // Group 0. Start / stop when in alert condition.
                speed_low_alert: 16, //  Group 0. Start / stop when in alert condition.
                cad_high_alert: 17, //    Group 0. Start / stop when in alert condition.
                cad_low_alert: 18, //   Group 0. Start / stop when in alert condition.
                power_high_alert: 19, //  Group 0. Start / stop when in alert condition.
                power_low_alert: 20, //   Group 0. Start / stop when in alert condition.
                recovery_hr: 21, //  marker.
                battery_low: 22, // marker.
                time_duration_alert: 23, //    Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
                distance_duration_alert: 24, // Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
                calorie_duration_alert: 25, // Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
                activity: 26, // Group 1.. Stop at end of activity.
                fitness_equipment: 27, // marker.
                length: 28 // Stop at end of each length.
            };




            if (FITUtil.isUndefined(rawdata)) {
                self.loggMessage("error","No rawdata available");
                return;
            }

            if (FITUtil.isUndefined(rawdata.event)) {
                self.loggMessage("error","No event information");
                return;
            }

            var eventLen = rawdata.event.timestamp.length;

            if (FITUtil.isUndefined(eventLen) || eventLen === 0) {
                self.loggMessage("error","No timestamp information from event, event.timestamp");
                return;
            }

           
            var xpos, ypos;
            var plotLeft = this.multiChart.plotLeft;
            var renderer = this.multiChart.renderer;
            var xaxis = this.multiChart.get(rawdataxAxis);

            var width = xaxis.width;
            //var extremes = this.multiChart.xAxis[0].getExtremes();
            var max = xaxis.max;
            var min = xaxis.min;

            if (typeof max === "undefined" || typeof min === "undefined") {
                self.loggMessage("log", "Max/Min of axis is undefined, cannot show events");
                return;
            }

            self.loggMessage("log","Event xaxis extremes datamin,datamax : ", min, max);

            var srcImgEvent, titleEvent;
            var SVGeventElement;



            this.removeSVGGroup(this.masterVM.eventGroup);

            this.masterVM.eventGroup = renderer.g('events').add();

            if (FITUtil.isUndefined(this.masterVM.freeYPOS))
                this.masterVM.freeYPOS = {};

            var waitForDelay = 3 * 60 * 1000;

            var recLen = rawdata.record.timestamp.length;
            var maxTimestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);

            for (var eventNr = 0; eventNr < eventLen; eventNr++) {
                var timestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]);

                if (timestamp < min)
                    continue;

                if (timestamp > maxTimestamp + waitForDelay || timestamp > max)
                    break;

                if (timestamp <= max && timestamp >= min)
                    xpos = Math.round(width * ((timestamp - min) / (max - min))) + plotLeft;
                else  // Gives us some issues with multisport...all events over max is displayed....
                {
                    timestamp = max;  // Force to max even if greater
                    xpos = width + plotLeft - 5;  // Move events that reaches beyond max down at end like f.ex. HR recovery
                }


                if (this.masterVM.freeYPOS[timestamp] >= 0)
                    this.masterVM.freeYPOS[timestamp] += 20;
                else
                    this.masterVM.freeYPOS[timestamp] = 0;

                var ev = rawdata.event.event[eventNr];
                var ev_type = rawdata.event.event_type[eventNr];

                srcImgEvent = "Images/event/unknown.png";
                titleEvent = "Event: " + ev.toString() + " Event type: " + ev_type.toString();

                switch (ev) {

                    case event.timer:

                        switch (ev_type) {

                            case event_type.start:
                                srcImgEvent = "Images/event_type/start_0.png";
                                titleEvent = "START";
                                break;

                            case event_type.stop:
                                srcImgEvent = "Images/event_type/stop_all_4.png";
                                titleEvent = "STOP";
                                break;

                            case event_type.stop_all:
                                srcImgEvent = "Images/event_type/stop_all_4.png";
                                titleEvent = "STOP ALL";
                                break;

                            case event_type.stop_disable:
                                srcImgEvent = "Images/event_type/stop_all_4.png";
                                titleEvent = "STOP DISABLE";
                                break;

                            case event_type.stop_disable_all:
                                srcImgEvent = "Images/event_type/stop_disable_all9.png";
                                titleEvent = "STOP DISABLE ALL";
                                break;

                        }

                      
                        break;

                    case event.battery: // Don't check for event_type marker

                        srcImgEvent = "Images/event/battery_marker.png";
                        titleEvent = "Battery";
                        if (rawdata.event.data[eventNr])
                            titleEvent += " - " + rawdata.event.data[eventNr].toString();
                        
                        break;

                    case event.recovery_hr: // Don't check for event type marker
                        srcImgEvent = "Images/heart.png";
                        titleEvent = "Recovery HR";
                       

                        if (rawdata.event.data[eventNr])
                            titleEvent += " - " + rawdata.event.data[eventNr].toString();
                        break;

                    case event.battery_low:
                        srcImgEvent = "Images/event/battery-low.png";
                        titleEvent = "Battery low";
                        if (rawdata.event.data[eventNr])
                            titleEvent += " - " + rawdata.event.data[eventNr].toString();
                       
                        break;

                    case event.power_down:
                        srcImgEvent = "Images/event/power_down.png";
                        titleEvent = "Power down";
                        
                        break;

                    case event.power_up:
                        srcImgEvent = "Images/event/power_up.png";
                        titleEvent = "Power up";
                       
                        break;

                    case event.session:
                        srcImgEvent = "Images/laptrigger/session_end.png";
                        titleEvent = "Stop - end of session";
                       
                        break;

                    case event.course_point:
                        srcImgEvent = "Images/laptrigger/position_marked.png";
                        titleEvent = "Course point";
                       
                        break;

                }

                titleEvent += " @ " + Highcharts.dateFormat('%H:%M:%S', FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));

                var eventRendered = false;
                if (srcImgEvent !== undefined) {
                    SVGeventElement = renderer.image(srcImgEvent, xpos, this.masterVM.freeYPOS[timestamp], 16, 16).add(this.masterVM.eventGroup);
                    eventRendered = true;
                    if (this.masterVM.freeYPOS[timestamp])
                        this.masterVM.freeYPOS[timestamp] += 20;

                    if (titleEvent)
                        SVGeventElement.attr({ title: titleEvent });
                }


            }


        },

        removeSVGGroup: function (SVG_group) {
            // Remove - http://stackoverflow.com/questions/6635995/remove-image-symbol-from-highchart-graph
            if (SVG_group)
                $(SVG_group.element).remove();

            this.masterVM.freeYPOS = {}; // Loose state of ypos for triggers,deviceinfo,events in multichart
        },

        showLapTriggers: function (rawdata) {

            if (FITUtil.isUndefined(rawdata)) {
                self.loggMessage("error","No rawdata, cannot show lap triggers");
                return;
            }

            if (FITUtil.isUndefined(rawdata.lap)) {
                self.loggMessage("error","No lap information");
                return;
            }

            var lapLen = rawdata.lap.timestamp.length;

            if (FITUtil.isUndefined(lapLen) || lapLen === 0) {
                self.loggMessage("error","No timestamp information from lap, lap.timestamp");
                return;
            }

            if (FITUtil.isUndefined(this.multiChart)) {
                self.loggMessage("error","Multichart not defined");
                return;

            }
           
            var xpos, ypos;
            var plotLeft = this.multiChart.plotLeft;
            var renderer = this.multiChart.renderer;

            var xaxis = this.multiChart.get(rawdataxAxis);

            var width = xaxis.width;
            //var extremes = this.multiChart.xAxis[0].getExtremes();
            var max = xaxis.max;
            var min = xaxis.min;

            if (typeof max === "undefined" || typeof min === "undefined") {
                self.loggMessage("log", "Max/Min of axis is undefined, cannot show lap triggers");
                return;
            }

            self.loggMessage("log","Lap triggers xaxis extremes datamin,datamax : ", min, max);

            var srcImg, title;
            var SVG_elmImg;

            this.removeSVGGroup(this.masterVM.lapTriggerGroup);

            this.masterVM.lapTriggerGroup = renderer.g('laptriggers').add();

            if (FITUtil.isUndefined(this.masterVM.freeYPOS))  // Used for stacked layout
                this.masterVM.freeYPOS = {};

            var waitForDelay = 3 * 60 * 1000;

            var recLen = rawdata.record.timestamp.length;
            var maxTimestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);

            for (var lapNr = 0; lapNr < lapLen; lapNr++) {
                var timestamp = FITUtil.timestampUtil.addTimezoneOffsetToUTC(rawdata.lap.timestamp[lapNr]);

                if (timestamp < min)
                    continue;

                if (timestamp > maxTimestamp + waitForDelay || timestamp > max)
                    break;


                if (timestamp <= max && timestamp >= min)
                    xpos = Math.round(width * ((timestamp - min) / (max - min))) + plotLeft;
                    //else
                    //    continue; // Skip overflowing triggers
                    //}
                else {
                    xpos = width + plotLeft - 5;  // Try to move timestamp beyond current max at end of chart
                    timestamp = max;
                }


                if (this.masterVM.freeYPOS[timestamp] >= 0)
                    this.masterVM.freeYPOS[timestamp] += 20;
                else
                    this.masterVM.freeYPOS[timestamp] = 0;


                switch (rawdata.lap.lap_trigger[lapNr]) {
                    case lap_trigger.manual:
                        srcImg = "Images/laptrigger/manual.png";
                        title = "LAP";
                        break;
                    case lap_trigger.time:
                        srcImg = "Images/laptrigger/time.png";
                        title = "Time";
                        break;
                    case lap_trigger.distance:
                        srcImg = "Images/laptrigger/distance.png";
                        title = "Distance";
                        if (rawdata.lap.total_distance[lapNr])
                            title += " "+rawdata.lap.total_distance[lapNr].toString()+" m";
                        
                        break;
                    case lap_trigger.position_start:
                        srcImg = "Images/laptrigger/position_start.png";
                        title = "Position start";
                        break;
                    case lap_trigger.position_lap:
                        srcImg = "Images/laptrigger/position_lap.png";
                        title = "Position lap";
                        break;
                    case lap_trigger.position_waypoint:
                        srcImg = "Images/laptrigger/position_waypoint.png";
                        title = "Position waypoint";
                        break;
                    case lap_trigger.position_marked:
                        srcImg = "Images/laptrigger/position_marked.png";
                        title = "Position marked";
                        break;
                    case lap_trigger.session_end:
                        srcImg = "Images/laptrigger/session_end.png";
                        title = "Session end";
                        break;
                    default:
                        srcImg = undefined;
                        title = undefined;
                }

                title += " @ " + Highcharts.dateFormat('%H:%M:%S', timestamp);

                if (srcImg !== undefined) {
                    SVG_elmImg = renderer.image(srcImg, xpos, this.masterVM.freeYPOS[timestamp], 16, 16).add(this.masterVM.lapTriggerGroup);
                    if (title)
                        SVG_elmImg.attr({ title: title });
                }

            }
        },

        showHRZones: function (rawdata, startTimestamp, endTimestamp, destroy) {

            if (typeof (destroy) !== "undefined") {
                if (destroy) {
                    if (self.HRZonesChart) {
                        self.HRZonesChart.destroy();
                        self.HRZonesChart = undefined;
                    }
                }
            }

            var divChartId = 'zonesChart';
            //var divChart = document.getElementById(divChartId);

            if (FITUtil.isUndefined(rawdata.record)) {
                self.loggMessage("warn","Cannot show HR zones data when there is no rawdata, tried looking in rawdata.record");
                return -1;
            }

            if (FITUtil.isUndefined(rawdata.record.heart_rate) || rawdata.record.heart_rate.length === 0) {
                self.loggMessage("warn","No HR data found, skipping HR Zones chart");
                //$('#zonesChart').hide();
                return;
            }

            //$('#zonesChart').show();

            if (self.HRZonesChart)
                self.HRZonesChart.destroy();

            //var options = {
            //    chart: {
            //        renderTo: 'zonesChart',
            //        type: 'bar'
            //    },
            //    title: {
            //        text: ''
            //    },
            //    xAxis: {

            //        //categories: [myZones[0].name, myZones[1].name, myZones[2].name, myZones[3].name, myZones[4].name]
            //        //type : 'datetime'
            //    },
            //    yAxis: {
            //        title: {
            //            text: 'Minutes'
            //        }
            //    }

            //    // Assuming 1 sec. sampling of data point -> divide by 60 to get number of minutes in zone
            //    //series: []
            //};

            // http://highcharts.com/demo/column-stacked
            var options = {
                chart: {
                    renderTo: divChartId,
                    type: 'column'
                },
                title: {
                    text: ''
                },
                xAxis: {

                    //categories: ['Apples', 'Oranges', 'Pears', 'Grapes', 'Bananas']
                    categories: ['HR Zones']
                },
                yAxis: {
                    min: 0,
                    title: {
                        text: null
                    },
                    stackLabels: {
                        enabled: false,
                        //style: {
                        //    fontWeight: 'bold',
                        //    color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                        //}
                    }
                },
                legend: {
                    enabled: false
                },
                //legend: {
                //    align: 'right',
                //    x: -100,
                //    verticalAlign: 'top',
                //    y: 20,
                //    floating: true,
                //    backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColorSolid) || 'white',
                //    borderColor: '#CCC',
                //    borderWidth: 1,
                //    shadow: false
                //},
                credits: {
                    enabled: false
                },
                tooltip: {
                    formatter: function () {
                        return this.series.name + ': ' + Highcharts.numberFormat(this.y, 1);
                    }
                },
                plotOptions: {
                    column: {
                        stacking: 'normal',
                        //dataLabels: {
                        //    enabled: false,
                        //    color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white'
                        //}
                    }
                }
                //,
                //series: [{
                //    name: 'John',
                //    data: [5, 3, 4, 7, 2]
                //}, {
                //    name: 'Jane',
                //    data: [2, 2, 3, 2, 1]
                //}, {
                //    name: 'Joe',
                //    data: [3, 4, 4, 2, 5]
                //}]
            };


            var myZones = getHRZones();

            var startIndex = FITUtil.getIndexOfTimestamp(rawdata.record, startTimestamp);
            var endIndex = FITUtil.getIndexOfTimestamp(rawdata.record, endTimestamp);
            self.loggMessage("log","Basing HR zone chart on start_time UTC :", new Date(startTimestamp), " at index ", startIndex, "on rawdata.record, and timestamp UTC :", new Date(endTimestamp), " at index: ", endIndex);

            for (var zone = 0; zone < myZones.length; zone++)
                myZones[zone].timeInZone = 0;

            var timeInZoneMillisec;
            var maxTimeDifference = 60000;

            for (var datap = startIndex; datap <= endIndex; datap++) {

                // var hry = rawData["heart_rate"][datap][1];

                if (datap < endIndex) {
                    timeInZoneMillisec = rawdata.record.timestamp[datap + 1] - rawdata.record.timestamp[datap];
                    // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/isNaN

                    if (isNaN(timeInZoneMillisec)) {// Should not happen....
                        self.loggMessage("error","Time in zone is NaN");
                        break;
                    }

                    if (timeInZoneMillisec > maxTimeDifference) {
                       self.loggMessage("warn","Greater than ", maxTimeDifference, "ms difference between timestamps, skipped (not calculated in HR zones)");
                        continue;
                    }

                } else if (datap === endIndex)
                    timeInZoneMillisec = 1000;


                var hry;

                // if (rawdata.record.heart_rate !== undefined)
                hry = rawdata.record.heart_rate[datap];
                //else
                //    hry = undefined;

                if (hry === undefined || hry === null)
                    self.loggMessage("error","Could not access heart rate raw data for record.timestamp " + rawdata.record.timestamp[datap].toString() + " at index " + datap.toString());
                else {
                    // Count Heart rate data points in zone
                    for (zone = 0; zone < myZones.length; zone++)
                        if (hry <= myZones[zone].max && hry >= myZones[zone].min) {

                            myZones[zone].timeInZone += timeInZoneMillisec;
                            //    console.log("HR ", hry, " time in zone", timeInZone, " zone ", zone, " total time (ms) ", myZones[zone].timeInZone);
                        }
                }
            }

            options.series = [];

            var timeInSecs;
            for (var catNr = myZones.length - 1; catNr >= 0; catNr--) {

                // s1.data.push([myZones[catNr].name + " (" + myZones[catNr].min.toString() + "-" + myZones[catNr].max.toString() + ")", myZones[catNr].count / 60]);
                // timeInSecs = parseFloat(((myZones[catNr].timeInZone) / 60000).toFixed(1));

                timeInSecs = myZones[catNr].timeInZone / 60000;

                options.series.push({
                    name: myZones[catNr].name,
                    data: [timeInSecs]
                });
            }


            self.HRZonesChart = new Highcharts.Chart(options);
        },

        showSessionMarkers: function (map, rawdata) {
            // Plot markers for start of each session

            var sessionStartPosFound = false;

            var mapCenterSet = false;

            var session = rawdata.session;

            var setMapCenter = function (sport, lat, long) {
                var latlong = new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(lat), FITUtil.timestampUtil.semiCirclesToDegrees(long));
                self.loggMessage("info","Setting map center for sport ", sport, " at ", latlong);
                map.setCenter(latlong);

                if (self.sessionMarkers === undefined || self.sessionMarkers === null)
                    self.sessionMarkers = [];

                var markerOptions = {
                    position: latlong,
                    map: map
                };

                // Select session marker according to sport mode
                var image;

                function newMarkerImage(imageName) {
                    return new google.maps.MarkerImage(imageName,
                            new google.maps.Size(32, 32),
                            new google.maps.Point(0, 0),
                            new google.maps.Point(0, 32));
                }

                //generic 0
                //running 1
                //cycling 2
                //transition 3 - Multisport transition
                //fitness_equipment 4
                //swimming 5
                //basketball 6
                //soccer 7
                //tennis 8
                //american_football 9
                //training 10
                //all 254 All is for goals only to include all sports.


                switch (sport) {
                    case FITSport.running:

                        image = newMarkerImage('Images/sport/running.png');
                        break;
                    case FITSport.cycling:
                        image = newMarkerImage('Images/sport/cycling.png');
                        break;

                    case FITSport.swimming:
                        image = newMarkerImage('Images/sport/swimming.png');
                        break;
                        // TO DO : Add more icons
                }

                if (image)
                    markerOptions.icon = image;

                self.sessionMarkers.push(new google.maps.Marker(markerOptions));
            };

            // Clear previous session markers
            if (self.sessionMarkers) {
                self.sessionMarkers.forEach(function (element, index, array) {
                    element.setMap(null);
                });

                self.sessionMarkers = null;
            }

            if (session && session.start_position_lat) {

                session.start_position_lat.forEach(function (element, index, array) {

                    var lat = element;
                    var long = session.start_position_long[index];

                    if (lat && long) {

                        sessionStartPosFound = true;

                        setMapCenter(session.sport[index], lat, long);

                        mapCenterSet = true;


                    }
                });
            }


            // Valid .FIT file have session record, but invalid fit may not....try to fetch from record head instead

            if (!sessionStartPosFound && rawdata.record) {
                var lat;

                if (rawdata.record.position_lat && rawdata.record.position_lat.length > 0) {
                    lat = rawdata.record.position_lat.shift();
                    rawdata.record.position_lat.unshift(lat);
                }

                var long;

                if (rawdata.record.position_long && rawdata.record.position_long.length > 0) {
                    long = rawdata.record.position_long.shift();
                    rawdata.record.position_long.unshift(long);
                }

                var sport;
                if (rawdata.lap && rawdata.lap.sport)
                    sport = rawdata.lap.sport[0];

                if (sport === undefined)
                    sport = 0; // Default to generic

                if (lat && long) {
                    self.loggMessage("info","No start position was found in session data, got a position at start of record messages.", lat, long);
                    setMapCenter(sport, lat, long);
                    mapCenterSet = true;
                } else
                    self.loggMessage("info","Got no start position from head/index 0 of position_lat/long");
            }

            return mapCenterSet;

        },

        showSessionsAsOverlay: function (map, rawdata) {

            var session = rawdata.session;
            var sessionCoords = [];
            var fillColors = [];
            // Remove previous overlays
            if (this.sessionRectangles !== undefined) {
                this.sessionRectangles.forEach(function (element, index, array) {
                    self.sessionRectangles[index].setMap(null);
                });
            }

            if (session === undefined)
                return false;

            if (session.swc_lat === undefined || session.swc_long === undefined || session.nec_lat === undefined || session.nec_long === undefined) {
                self.loggMessage("info","No swc/nec data available in session");
                return false;
            }

           
            self.sessionRectangles = [];
           

            session.swc_lat.forEach(function (value, index, array) {


                if (session.swc_lat[index] &&
                    session.swc_long[index] &&
                    session.nec_lat[index] &&
                    session.nec_long[index]) {
                    sessionCoords.push([
                new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(session.swc_lat[index]), FITUtil.timestampUtil.semiCirclesToDegrees(session.swc_long[index])),
                new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(session.swc_lat[index]), FITUtil.timestampUtil.semiCirclesToDegrees(session.nec_long[index])),
                new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(session.nec_lat[index]), FITUtil.timestampUtil.semiCirclesToDegrees(session.nec_long[index])),
                new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(session.nec_lat[index]), FITUtil.timestampUtil.semiCirclesToDegrees(session.swc_long[index]))]);
                }

                switch (session.sport[index]) {
                    case FITSport.running:
                        fillColors.push("#339933");
                        break;
                    case FITSport.cycling:
                        fillColors.push("#999");
                        break;
                    case FITSport.swimming:
                        fillColors.push("#0066CC");
                        break;
                    default:
                        fillColors.push("#339933");
                        break;
                }

                self.sessionRectangles.push(new google.maps.Polygon({
                    paths: sessionCoords[index],
                    strokeColor: "#000000",
                    strokeOpacity: 0.10,
                    strokeWeight: 1,
                    fillColor: fillColors[index],
                    fillOpacity: 0.10
                }));

                self.sessionRectangles[index].setMap(map);

            }
                );

            return true;
        },

        initMap: function () {

            var myCurrentPosition, newMap;

            // f.ex in case google maps api is not downloaded due to network problems....
            // http://joshua-go.blogspot.no/2010/07/javascript-checking-for-undeclared-and.html

            if (FITUtil.isUndefined(google))
                return undefined;

            var mapOptions = {
                zoom: 11,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };

            newMap = new google.maps.Map(document.getElementById("activityMap"), mapOptions);


            if (navigator.geolocation) {
                // Async call with anonymous callback..
                navigator.geolocation.getCurrentPosition(function (position) {
                    myCurrentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                    var currentCenter = newMap.getCenter();

                    if (currentCenter === undefined)
                        newMap.setCenter(myCurrentPosition);
                });
            }

            return newMap;
        },

        showLaps: function (rawData) {


            this.divSessionLap.show();


        },

        showPolyline: function (rawdata, map, record, startTimestamp, endTimestamp, strokeOptions, type) {

            var chosenStrokeColor = "#FF0000";
            var chosenStrokeWeight = 1;
            var chosenStrokeOpacity = 1;

            if (strokeOptions) {
                if (strokeOptions.strokeColor)
                    chosenStrokeColor = strokeOptions.strokeColor;
                if (strokeOptions.strokeWeight)
                    chosenStrokeWeight = strokeOptions.strokeWeight;
                if (strokeOptions.strokeOpacity)
                    chosenStrokeOpacity = strokeOptions.strokeOpacity;
            }

            // Clear previous polylines
            if (self.masterVM.activityPolyline) {
                for (var propType in self.masterVM.activityPolyline) { // Clear everything sessions,laps
                    if (self.masterVM.activityPolyline.hasOwnProperty(propType)) {
                        //console.log("Clearing ", propType);
                        if (self.masterVM.activityPolyline[propType] !== null) {
                            self.masterVM.activityPolyline[propType].setMap(null);
                            self.masterVM.activityPolyline[propType] = null;
                        }
                    }
                }
            }
            else if (FITUtil.isUndefined(self.masterVM.activityPolyline))
                self.masterVM.activityPolyline = {};

            if (record === undefined) {
                self.loggMessage("info","No record msg. to based plot of polyline data for session,lap etc.");
                return false;
            }

            if (!FITUtil.hasGPSData(rawdata))
                return false;

            if (self.masterVM.activityCoordinates)
                self.masterVM.activityCoordinates[type] = [];
            else {
                self.masterVM.activityCoordinates = {};
                self.masterVM.activityCoordinates[type] = [];
            }



            // Build up polyline

            var latLength = record.position_lat.length;
            var longLength = record.position_long.length;

            self.loggMessage("info","Total GPS points available (position_lat,position_long) : ", latLength, longLength);

            //var sampleInterval = Math.floor(latLength / 30);

            //if (sampleInterval < 1)
            //    sampleInterval = 1;

            var sampleInterval = 2; // Max. sampling rate for 910XT is 1 second 

            self.loggMessage("info","Sample length for polyline is ", sampleInterval);

            //var sample = 0;

            //var sampleLimit = 100;

            //var findNearestTimestamp = function(timestamp) {
            //    var indxNr;
            //    for (indxNr = 0; indxNr < latLength; indxNr++) {
            //        if (record.timestamp[indxNr] >= timestamp)
            //            break;
            //    }
            //    return indxNr;
            //};

            var indexStartTime = FITUtil.getIndexOfTimestamp(record, startTimestamp);

            var indexEndTime = FITUtil.getIndexOfTimestamp(record, endTimestamp);


            for (var index = indexStartTime; index <= indexEndTime; index++) {
                if (index === indexStartTime || (index % sampleInterval === 0) || index === indexEndTime)
                    if (record.position_long[index] !== undefined && record.position_lat[index] !== undefined && rawdata.dirty[index] !== true) {
                        //console.log("Setting lat,long in activityCoordinates",record.position_lat[index],record.position_long[index]," index", index);
                        self.masterVM.activityCoordinates[type].push(new google.maps.LatLng(FITUtil.timestampUtil.semiCirclesToDegrees(record.position_lat[index]), FITUtil.timestampUtil.semiCirclesToDegrees(record.position_long[index])));
                    }
            }

            self.loggMessage("info","Total length of polyline array with coordinates is : ", self.masterVM.activityCoordinates[type].length.toString());

            self.masterVM.activityPolyline[type] = new google.maps.Polyline({
                path: self.masterVM.activityCoordinates[type],
                strokeColor: chosenStrokeColor,
                strokeOpacity: chosenStrokeOpacity,
                strokeWeight: chosenStrokeWeight
            });

            self.masterVM.activityPolyline[type].setMap(map);

            return true;
        },

        intepretMessageCounters: function (counter, type) {
            if (FITUtil.isUndefined(counter)) {
                self.loggMessage("warn","Message counters is undefined, cannot intepret counter of global messages in FIT file");
                return -1;
            }

            if (counter.fileIdCounter !== 1)
                self.loggMessage("error","File id msg. should be 1, but is ", counter.fileIdCounter);
            if (counter.fileCreatorCounter !== 1)
                self.loggMessage("error","File creator msg. should be 1, but is ", counter.fileCreatorCounter);

            if (type === FITFileType.activityfile) { // Activity

                if (counter.sessionCounter === 0)
                    self.loggMessage("error","Session msg. should be at least 1, but is ", counter.sessionCounter);
                if (counter.lapCounter === 0)
                    self.loggMessage("error","Lap msg. should be at least 1, but is ", counter.lapCounter);
                if (counter.activityCounter !== 1)
                    self.loggMessage("error","Activity msg. should be 1, but is ", counter.activityCounter);
                if (counter.deviceInfoCounter === 0)
                    self.loggMessage("error","Expected more than 0 device_info msg. ", counter.deviceInfoCounter);
                if (counter.recordCounter === 0)
                    self.loggMessage("error","No record msg. ", counter.lapCounter);
            }

        },

        resetViewModel: function (viewModel, fieldDefProperties) {


            //var sessionFieldDef = fitActivity.session();

            // Take timestamp first to collapse DOM outline and hopefully make other collapses "hidden"

            if (viewModel.timestamp)
                viewModel.timestamp([]);

            var fieldDefProperty;
            for (var fieldDefNr in fieldDefProperties) {
                fieldDefProperty = fieldDefProperties[fieldDefNr].property;
                if (viewModel[fieldDefProperty] && fieldDefProperty !== "timestamp") {
                    // console.log("RemoveAll() on ", observableArray);
                    viewModel[fieldDefProperty]([]);
                }
            }



        },

        // Handles a sport setting file - info about heart rate/speed/power zones
        processSportSettingFile: function (rawData) {
            // From profile.xls
            var hr_zone_calc = {
                custom: 0,
                percent_max_hr: 1,
                percent_hrr: 2
            };

            var pwr_zone_calc = {
                custom: 0,
                percent_ftp: 1
            };

            // rawData.hr_zone
            // "{"name":["HR Zone 0","HR Zone 1","HR Zone 2","HR Zone 3","HR Zone 4","HR Zone 5"],"message_index":[0,1,2,3,4,5],"high_bpm":[106,140,150,159,171,177]}"

        },

        resetLapSessionViewModel : function ()
        {
            // Clean up UI state
            self.masterVM.sessionVM.selectedSession(undefined);
            self.masterVM.lapVM.selectedLap(undefined);
            self.resetViewModel(self.masterVM.sessionVM, fitActivity.session());
            self.resetViewModel(self.masterVM.lapVM, fitActivity.lap());
            //// http://api.highcharts.com/highcharts#Chart.destroy()

            //if (self.multiChart) {
            //    self.multiChart.destroy();
            //    self.multiChart = undefined;
            //}

        },

        resetTimestampIndexCache: function () {
            if (typeof (self.timestampIndexCache) === "undefined")
                self.timestampIndexCache = [];
            else
                self.timestampIndexCache.splice(0); // Explicit remove, but could probably use = [] ant let GC take care of the old array
        },

        hasHRVdata: function(rawdata) {
            if (rawdata && rawdata.hrv && rawdata.hrv.time && rawdata.hrv.time.length > 0)
                return true;
            else
                return false;

        },

        setupHRVexport: function (rawdata) {
            // Max string length in Chrome : 512MB http://stackoverflow.com/questions/4695187/javascript-maximum-size-for-types
            // http://updates.html5rocks.com/2012/06/Don-t-Build-Blobs-Construct-Them
            // http://updates.html5rocks.com/2011/08/Downloading-resources-in-HTML5-a-download
            if (!self.hasHRVdata(rawdata)) {
                self.loggMessage("warn","No HRV data available for export as CSV");
                return;
            }

            var CRLF = '\r\n';

            var type = self.masterVM.exportVM.csv.selectedType();
            var header = self.masterVM.exportVM.csv.header();
            var scale = self.masterVM.exportVM.csv.scale();
           // var headerTitle = self.masterVM.exportVM.headerTitle();


            var headerStr ;
            var CSVtimeStr;

            var len = rawdata.hrv.time.length;

            function setCSVString() {
                CSVtimeStr = "";
                headerStr = "";
                if (header) {
                    if (type === "scatter")
                        headerStr = 'point,';
                    else if (type === "bar/column")
                        headerStr = 'category,';
                    else if (type !== "raw")
                        self.loggMessage("warn","Unknown CSV export type", type, "choosing default raw");

                    headerStr += 'time' + CRLF;
                    CSVtimeStr = headerStr;
                }

                for (var pointNr = 0; pointNr < len; pointNr++) {
                    if (type === "scatter")
                        CSVtimeStr += pointNr.toString() + ',';
                    else if (type === "bar/column")
                        CSVtimeStr += 'time,';

                    CSVtimeStr += rawdata.hrv.time[pointNr] * scale + CRLF
                }
                
            }

            setCSVString();
            
            // Strip off last CRLF
            CSVtimeStr = CSVtimeStr.slice(0, CRLF.length * -1);

            // Blob(array,objectliteral)
         
            self.masterVM.exportVM.csv.blob = new Blob([CSVtimeStr], { type: 'text/csv' });
            self.loggMessage("log","Size of CSV blob:", self.masterVM.exportVM.csv.blob.size, " bytes");

            window.URL = window.URL || window.webkitURL;

            if (self.masterVM.exportVM.csv.url())
                window.URL.revokeObjectURL(self.masterVM.exportVM.csv.url()); // Get rid of prev. url

            self.masterVM.exportVM.csv.url(window.URL.createObjectURL(self.masterVM.exportVM.csv.blob));

            // Chrome
            var aHRVExport = document.getElementById('aExportHRV_CSV');
            aHRVExport.href = self.masterVM.exportVM.csv.url();
            aHRVExport.download = "export.csv";


        },


        // Handles an ordinary activity file with measurement and GPS data
        processActivityFile: function (rawData) {
           
            self.resetLapSessionViewModel();
            self.resetTimestampIndexCache(); // Tries to speed up lookup of timestamps

            var counter = rawData._msgCounter_;

            self.intepretMessageCounters(counter, FITFileType.activityfile);

            if (rawData.record)
                FITUtil.setDirtyTimestamps(rawData, rawData.record.timestamp);
            else
                self.loggMessage("warn","No rawdata present on rawdata.record - no data in file");

            // Enable export of HRV data
            
            self.setupHRVexport(rawData);
            
            // Value converters that are run on "create"-event/callback in knockout
            var mappingOptions = {
                //'start_time' : {
                //    create: function (options) {
                //        return new FITUI.convertToFullDate(options.data);
                //    }
                //},
                'total_elapsed_time': {
                    create: function (options) {
                        return new FITViewUIConverter.convertSecsToHHMMSSModel(options.data);
                    }
                },
                'total_timer_time': {
                    create: function (options) {
                        return new FITViewUIConverter.convertSecsToHHMMSSModel(options.data);
                    }
                },
                'avg_speed': {
                    create: function (options) {
                        return new FITViewUIConverter.convertSpeedConverterModel(options.data);
                    }
                },
                'max_speed': {
                    create: function (options) {
                        return new FITViewUIConverter.convertSpeedConverterModel(options.data);
                    }
                }
            };

            if (rawData.session === undefined)
               rawData.session = FITUtil.restoreSession(rawData); // Maybe do more work on this, but not prioritized

            self.masterVM.sessionVM.setRawdata(self, rawData);

            ko.mapping.fromJS(rawData.session, mappingOptions, self.masterVM.sessionVM);

            self.masterVM.sessionVM.selectedSession(0);  // Start with first session, there is no session object but an common index for a timestamp to all arrays 

            self.masterVM.lapVM.setRawdata(self, rawData);
            ko.mapping.fromJS(rawData.lap, mappingOptions, self.masterVM.lapVM);

            // Activity file

            self.showLaps(rawData);

            // Try to catch errors in session start_time/timestamp
            var start_time;

            if (FITUtil.isUndefined(rawData.session.start_time)) {

                self.loggMessage("warn","Session start time not found");
                start_time = rawData.lap.start_time[0];

                if (start_time === undefined) {
                    self.loggMessage("warn","Session start time not found in first lap either, trying record head");
                    start_time = rawData.record.timestamp[0];
                }

                self.loggMessage("info","Found start_time for session:", start_time);

                rawData.session.start_time = [];
                rawData.session.start_time.push(start_time);
            } else
                start_time = rawData.session.start_time[0];

            var timestamp;

            if (FITUtil.isUndefined(rawData.session.timestamp)) {
                self.loggMessage("warn","Session end time not found");
                timestamp = rawData.lap.timestamp[rawData.session.num_laps - 1];
                self.loggMessage("info","Timestamp of lap", rawData.session_num_laps, "is :", timestamp);

                if (timestamp === undefined) {
                    self.loggMessage("warn","Session end not found in timestamp for lap", rawData.session.num_laps);
                    var len = rawData.record.timestamp.length;
                    timestamp = rawData.record.timestamp[len - 1];
                    self.loggMessage("info","Timestamp of last rawdata.record is :", timestamp);
                }
                rawData.session.timestamp = [];
                rawData.session.timestamp.push(timestamp);
            } else
                timestamp = rawData.session.timestamp[0];

            if (self.map) {
                var sessionMarkerSet = self.showSessionMarkers(self.map, rawData);

                var sessionAsOverlaySet = self.showSessionsAsOverlay(self.map, rawData);

                var polylinePlotted = self.showPolyline(rawData, self.map, rawData.record, rawData.session.start_time[0], rawData.session.timestamp[0],
                    {
                        strokeColor: 'red',
                        strokeOpacity: 1,
                        strokeWeight: 1
                    }, "session");
            }
            //if (sessionMarkerSet || sessionAsOverlaySet || polylinePlotted)
            //   $('#activityMap').show();

            var destroy = true;
            self.showHRZones(rawData, rawData.session.start_time[0], rawData.session.timestamp[0],destroy);
            self.showMultiChart(rawData, rawData.session.start_time[0], rawData.session.timestamp[0], rawData.session.sport[0],destroy);

            //FITUI.showDataRecordsOnMap(eventdata.datamessages); 
        },

        getStartPosition : function(rawdata)
        {
            // In case recording is started before GPS signal is aquired, no start_position is written in rawdata

            function restoreStartPos(root,property,value) {
                if (root) {  
                    root[property] = [];
                    root[property].push(value);
                }
            }

            // Steps; first check session, then lap, then record head
            var lat, long;

            // Session
            if (rawdata.session && rawdata.session.start_position_lat && rawdata.session.start_position_lat.length >= 1)
                lat = rawdata.session.start_position_lat[0];

            if (rawdata.session && rawdata.session.start_position_long && rawdata.session.start_position_long.length >= 1)
                long = rawdata.session.start_position_long[0];

            // Lap
            if (typeof (lat) === "undefined" && rawdata.lap && rawdata.lap.start_position_lat && rawdata.session.start_position_lat.length >= 1) {

                lat = rawdata.lap.start_position_lat[0];
                restoreStartPos(rawdata.session, "start_position_lat", lat);
                
            }

            if (typeof (long) === "undefined" && rawdata.lap && rawdata.lap.start_position_long && rawdata.session.start_position_long.length >= 1) {

                long = rawdata.lap.start_position_long[0];
                restoreStartPos(rawdata.session, "start_position_long", long);
            }

            // Record

            if (typeof (lat) === "undefined" && typeof (long) === "undefined" && rawdata.record && rawdata.record.position_lat && rawdata.record.position_long) {
                var len = rawdata.record.position_lat.length;
                for (var posNr = 0; posNr < len; posNr++) {
                    lat = rawdata.record.position_lat[posNr];
                    long = rawdata.record.position_long[posNr];
                    if (lat !== undefined && long !== undefined)
                        break;
                }

                restoreStartPos(rawdata.session, "start_position_lat", lat);
                restoreStartPos(rawdata.session, "start_position_long", long);
                restoreStartPos(rawdata.lap, "start_position_lat", lat);
                restoreStartPos(rawdata.lap, "start_position_long", long);
            }

            return {
                lat: lat,
                long: long
            };

        },

        // Communication with import file worker thread
        onFITManagerMsg: function (e) {
            // NB Callback, this reference....

            var eventdata = e.data;

            var fileIdType;
            var rawData;

            switch (eventdata.response) {

                //case 'messageCounter':
                //    self.messageCounter = eventdata.counter;
                //    break;

                case 'rawData':
                   
                    // Clean up reference to file blob
                    //window.URL = window.URL || window.webkitURL;

                    //window.URL.revokeObjectURL(eventdata.file);

                     rawData = eventdata.rawdata;
                 
                    // TO DO: push rawdata in an viewmodel for imported rawdata files....

                    if (FITUtil.isUndefined(rawData)) {
                        self.loggMessage("error","Received undefined rawdata from import worker thread, its discarded, no further processing necessary");
                        break;
                    }

                    if (rawData.file_id)
                        self.loggMessage("info","file_id message : ", JSON.stringify(rawData.file_id));

                    if (rawData.file_creator)
                        self.loggMessage("info","file_creator message : ", JSON.stringify(rawData.file_creator));

                    if (rawData.file_id) {
                        fileIdType = rawData.file_id.type[0];

                        if (rawData.file_id.type.length > 1)
                            self.loggMessage("warn","More than 1 file_id type");
                    }
                    else {
                        // Normally FIT files contains exactly ONE file_id message at the start

                        if (rawData.session || rawData.lap || rawData.record) {
                            self.loggMessage("log","No file_id message in FIT file, but assume its an acivity file - found session or lap or record");
                            fileIdType = FITFileType.activityfile;
                        }
                    }

                    switch (fileIdType) {
                        // Activity file
                        case FITFileType.activityfile:

                            self.loggMessage("info","Processing an activity file");
                            var latLongString;
                            var startPosition = self.getStartPosition(rawData);
                            
                            if (startPosition.lat && startPosition.long) {
                                latLongString = (new FIT.CRCTimestampUtility()).getLatLongStringForUrl(startPosition.lat, startPosition.long);

                                // https://developers.google.com/maps/documentation/staticmaps/index

                                // Can use javascript escape(string) to make transferable URL
                                rawData._staticGoogleMapSrc = ko.observable('http://maps.googleapis.com/maps/api/staticmap?center=' + latLongString
                                    + '&zoom=8&size=100x100&maptype=roadmap&sensor=false&scale=1'+
                                    '&markers=size:tiny%7Ccolor:red%7C'+latLongString+'&key=AIzaSyDvei58o_T1ViClyqpY9728ob_RhbhbiRg');

                                //rawData._staticGoogleMapSrc = ko.observable('http://localhost:24021/Images/kcalorie.png');
                            }

                            self.masterVM.activityVM.activity.push(rawData); // Let knockoujs track new activities - calls knockouts push function on array

                            // If not previous activity has been selected process this one...
                            if (self.masterVM.activityVM.selectedActivity() === undefined) {
                                self.masterVM.activityVM.selectedActivity(self.masterVM.activityVM.activity().length - 1);
                                self.processActivityFile(rawData);
                            }
                            break;

                            // Sport settings (HR zones)

                        case FITFileType.sportsettingfile:
                            self.loggMessage("info","Processing a sport settings file");
                            self.processSportSettingFile(rawData);
                            break;

                        default:
                            self.loggMessage("info","Cannot process file id with type : ", fileIdType);
                            break;
                    }

                    break;

                //case 'header':
                //    var headerInfo = eventdata.header;

                //    console.info("FIT file header : " + JSON.stringify(headerInfo));

                //    // Copy to view model
                //    self.masterVM.headerInfoVM.fileName(headerInfo.fitFile.name);
                //    self.masterVM.headerInfoVM.fileSize(headerInfo.fitFile.size);
                //    self.masterVM.headerInfoVM.protocolVersion(headerInfo.protocolVersionMajor + "." + headerInfo.protocolVersionMinor);

                //    self.masterVM.headerInfoVM.profileVersion(headerInfo.profileVersionMajor + "." + headerInfo.profileVersionMinor);
                //    self.masterVM.headerInfoVM.dataType(headerInfo.dataType);
                //    self.masterVM.headerInfoVM.headerCRC(headerInfo.headerCRC);
                //    self.masterVM.headerInfoVM.verifyHeaderCRC(headerInfo.verifyHeaderCRC);
                //    self.masterVM.headerInfoVM.headerSize(headerInfo.headerSize);
                //    self.masterVM.headerInfoVM.dataSize(headerInfo.dataSize);
                //    self.masterVM.headerInfoVM.estimatedFitFileSize(headerInfo.estimatedFitFileSize);

                //    if (headerInfo.estimatedFitFileSize !== headerInfo.fitFile.size)
                //        console.warn("Header reports FIT file size " + headerInfo.estimatedFitFileSize.toString() + " bytes, but file system reports: " + headerInfo.fitFile.size.toString() + " bytes.");
                //    break;

                case 'error':
                    var errMsg = eventdata.data;

                    if (eventdata.event !== undefined) {
                        errMsg += " Event; ";
                        for (var prop in eventdata.event) {
                            if (typeof prop === "string")
                                errMsg += "property " + prop + " : " + eventdata.event.prop;
                        }
                    }
                    self.loggMessage("error",errMsg);
                    break;

                case 'info':
                    self.loggMessage("info",eventdata.data);
                    break;

                case 'importProgress':

                    self.masterVM.progressVM.progress(eventdata.data);

                    //FITUI.progressFITImport.setAttribute("value", eventdata.data);
                    break;

                case 'importFinished':
                    //FITUI.masterVM.progressVM.progress(100);
                    $("#progressFITimport").hide();
                    self.masterVM.progressVM.progress(0);

                    break;

                default:
                    self.loggMessage("error","Received unrecognized message from worker " + eventdata.response);
                    break;
            }



        },

        loggMessage: function (type,msg)
        {
            if (self.masterVM.settingsVM.logging())
                console[type](msg);
        },

        onFITManagerError: function (e) {
            self.loggMessageg("error","Error in worker, event: ", e);
        },

        // Handles file selection for import
        onFitFileSelected: function (e) {

            if (FITUtil.isUndefined(e.target.files) || e.target.files.length === 0) {
                self.loggMessage("warn","No file selected for import");
                return;
            }

            // console.log(e);
            e.preventDefault();

            //$('#activityMap').hide();

           

            self.selectedFiles = e.target.files;

            var files = self.selectedFiles;
            var firefox_compatible_files = [];

            var len = self.selectedFiles.length;
            for (var fileNr = 0; fileNr < len; fileNr++) {
                firefox_compatible_files.push(files[fileNr]);
            }
            

            // Make sure we terminate previous worker
            if (self.fitFileManager) {
                self.fitFileManager.removeEventListener('error', self.onFITManagerError, false);
                self.fitFileManager.removeEventListener('message', self.onFITManagerMsg, false);
                self.fitFileManager.terminate();
            }

            self.fitFileManager = new Worker("Scripts/FITImport.js");
            self.fitFileManager.addEventListener('message', self.onFITManagerMsg, false);
            self.fitFileManager.addEventListener('error', self.onFITManagerError, false);

            // Firefox bug : cannot pass FileList -> dataclone error
            var msg = {
                request: 'importFitFile',
                fitfiles : firefox_compatible_files,
                fitfile: undefined,
                store: self.masterVM.settingsVM.storeInIndexedDB(),
                logging : self.masterVM.settingsVM.logging()
                //, "query": query
            };

            $("#progressFITimport").show();

            self.fitFileManager.postMessage(msg); // Let's import FIT file in the background...

        },

        showDataRecordsOnMap: function (dataRecords) {


            var FIT_MSG_FILEID = 0;
            var FIT_MSG_SESSION = 18;
            var FIT_MSG_LAP = 19;
            var FIT_MSG_RECORD = 20;
            var FIT_MSG_EVENT = 21;
            var FIT_MSG_ACTIVITY = 34;
            var FIT_MSG_FILE_CREATOR = 49;
            var FIT_MSG_HRV = 78;
            var FIT_MSG_DEVICE_INFO = 23;
            var FIT_MSG_LENGTH = 101;

            // Clear div
            while (this.divMsgMap.firstChild) {
                this.divMsgMap.removeChild(this.divMsgMap.firstChild);
            }

            dataRecords.forEach(function (element, index, array) { // forEach takes a callback

                var styleClass = "";
                switch (element) {
                    case FIT_MSG_FILEID: styleClass = 'FITfile_id'; break;
                    case FIT_MSG_SESSION: styleClass = 'FITsession'; break;
                    case FIT_MSG_LAP: styleClass = 'FITlap'; break;
                    case FIT_MSG_RECORD: styleClass = 'FITrecord'; break;
                    case FIT_MSG_DEVICE_INFO: styleClass = 'FITdevice_info'; break;
                    case FIT_MSG_ACTIVITY: styleClass = 'FITactivity'; break;
                    case FIT_MSG_HRV: styleClass = 'FIThrv'; break;
                    case FIT_MSG_EVENT: styleClass = 'FITevent'; break;
                    case FIT_MSG_FILE_CREATOR: styleClass = 'FITfile_creator'; break;
                    case FIT_MSG_LENGTH: styleClass = 'FITlength'; break;
                    default: styleClass = 'FITunknown'; break;
                }

                self.divMsgMap.insertAdjacentHTML("beforeend", '<div class=' + styleClass + '></div>');
            });
        }
    };

    window.onload = function () {
        FITViewUI.init();  // Let's get started....
    };

    function deleteDb() {
        // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory#deleteDatabase
        // Problem : can only delete indexeddb one time in the same tab
        //self.postMessage({ response: "info", data: "deleteDb()" });

        var req;

        try {
            req = indexedDB.deleteDatabase("fit-import");
        } catch (e) {
            self.loggMessage("error",e.message);
        }
        //req.onblocked = function (evt) {
        //    self.postMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
        //}


        req.onsuccess = function (evt) {
            self.loggMessage("info","Delete " + evt.currentTarget.readyState);

        };

        req.onerror = function (evt) {
            self.loggMessage("error","Error deleting database");
        };

    }

    function saveHRZones(e) {

    }

    function getHRZones() {
        // Assume browser supports localStorage
        var localStorage = window.localStorage;
        var key = "FITView.HRZones";
        var myZonesJSONString = localStorage.getItem(key);

        var myZones;
        if (myZonesJSONString !== null)
            myZones = JSON.parse(myZonesJSONString);
        else {
            self.loggMessage("info","Local storage of " + key + " not found, using default HR Zones");
            myZones = [{ name: 'Zone 1', min: 106, max: 140 },   // No storage found use default
                     { name: 'Zone 2', min: 141, max: 150 },
                     { name: 'Zone 3', min: 151, max: 159 },
                     { name: 'Zone 4', min: 160, max: 170 },
                     { name: 'Zone 5', min: 171, max: 256 }];
        }

        return myZones;
    }

})

(); // Immediately-Invoked Function Expression (IIFE) - Run it