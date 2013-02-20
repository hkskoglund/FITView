//use strict

(function () {

    var FITUI;
    var FITUtil;

    window.onload = function () {
        FITUI = new UIController();
        FITUtil = new FITUIUtility();
    };

    function UIController() {

        var self = this;

        var fitActivity = FIT.ActivityFile();

        var util = FITUtility();

        // Had to introduce this due to some issues with databinding, if new properties was introduced in rawdata,
        // databinding would not kick in even when data is mapped ok. Probably is due to some issues with <!-- ko: if -->
        // virtual elements and something with "changed" value notification. Introducing empty observables on unused properties gives a performance penalty.
        getEmptyViewModel = function (msg) {
            var ViewModel = {};

            for (var fieldDefNr in msg)
                ViewModel[msg[fieldDefNr].property] = ko.observableArray([]);

            return ViewModel;

        };

        loadSeriesViaButtonViewModel = function () {
            var self = this;
            // var chart, seriesData;

            //self.chart = chart;
            //self.seriesData = seriesData;

            self.setNewChartAndSeriesData = function (chart, seriesData) {
                self.chart = chart;
                self.seriesData = seriesData;
            }

            self.loadChart = function () {
                // this is highchart series id.
                var id = this.id;
                var name = this.name;

                var series = self.chart.get(id);

                if (typeof (series) === "undefined" || series === null) {
                    if (self.seriesData[id]) {
                        console.log("Loading series id: ", id);
                        self.chart.addSeries({
                            name: name,
                            id: id,
                            data: self.seriesData[id]
                        });
                    } else
                        console.warn("No data available for load request of series id: ", id);
                }
                    //if (series && series.data.length === 0) {
                    //    // Add only fresh data

                    //    series.setData(self.seriesData[id]);

                    //}
                else
                    console.error("Data already loaded, skipped series id", id);
            }

        }




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


        this.masterVM = {

            speedMode : ko.observable(),

            headerInfoVM: {

                fileName: ko.observable(),
                fileSize: ko.observable(),
                headerSize: ko.observable(),
                dataSize: ko.observable(),
                estimatedFitFileSize : ko.observable(),
                protocolVersion: ko.observable(),
                
                profileVersion: ko.observable(),
                
                dataType: ko.observable(),
                headerCRC: ko.observable(),
                verifyHeaderCRC : ko.observable()

            },

            settingsVM: {
                timeZoneDifferenceUTC : util.getTimezoneOffsetFromUTC(),
                showLapLines: ko.observable(true),
                showLapTriggers: ko.observable(false),
                showEvents: ko.observable(false),
                showLegends: ko.observable(true),
                storeInIndexedDB: ko.observable(false),
                showDeviceInfo: ko.observable(false),
                showHeaderInfo: ko.observable(false),
                forceSpeedKMprH : ko.observable(false)
            },

            progressVM: {
                progress: ko.observable(0)
            },

            sessionVM: getEmptyViewModel(fitActivity.session()),

            lapVM: getEmptyViewModel(fitActivity.lap()),
            

            loadChartVM: new loadSeriesViaButtonViewModel()  // Give possibility for ondemand loading of data -> to speed up start/not loading all data at once

        };

        //this.masterVM.lapVM.speedMode = ko.observable();

        // http://stackoverflow.com/questions/11177565/knockoutjs-checkbox-changed-event
        this.masterVM.settingsVM.showLapLines.subscribe(function (showLapLines) {
            // Callback from knockoutjs
            if (!showLapLines) {
                if (self.multiChart)
                    self.multiChart.xAxis[0].removePlotLine('plotLines');
            }
            else
               if (self.multiChart)
                    self.addLapLines(self.masterVM.sessionVM.rawData,self.multiChart);
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
       
        this.masterVM.settingsVM.forceSpeedKMprH.subscribe(function (forceSpeedKMprH) {
            var util = FITUtility();

            var speedSeries;
            var speedSeriesData;

            var rawData = self.masterVM.sessionVM.rawData;
            var timezoneDiff = util.getTimezoneOffsetFromUTC()
            var startTimestamp,endTimestamp;

            if (self.multiChart) { 
                speedSeries = self.multiChart.get('speedseries');
                startTimestamp = self.multiChart.xAxis[0].min-timezoneDiff;
                endTimestamp = self.multiChart.xAxis[0].max - timezoneDiff;
              
            }

            if (speedSeries) {
                if (forceSpeedKMprH) {
                    self.masterVM.previousSpeedMode = self.masterVM.speedMode();
                    self.masterVM.previousSpeedData = speedSeries.data;
                    speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToKMprH, 'speedseries');
                    
                    self.masterVM.speedMode(2);
                    
                } else {
                    self.masterVM.speedMode(self.masterVM.previousSpeedMode);
                    if (self.masterVM.previousSpeedMode === 1) // Running
                      speedSeriesData = speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToMinutes, 'speedseries');
                    else
                        speedSeriesData = FITUtil.combine(rawData, rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToKMprH, 'speedseries');
                }

                // Toggle lap lines - to update speed 
                if (self.masterVM.settingsVM.showLapLines()) {

                    self.masterVM.settingsVM.showLapLines(false);
                    self.masterVM.settingsVM.showLapLines(true);
                }
                speedSeries.setData(speedSeriesData, true);
            }
        });

        var bodyId = '#divSessionLap';
        var jqueryBodyElement = $(bodyId);
        var bodyElement = jqueryBodyElement[0];


        this.masterVM.sessionVM.selectedSession = ko.observable(undefined);
        this.masterVM.sessionVM.tempoOrSpeed = ko.observable(undefined);
        this.masterVM.lapVM.tempoOrSpeed = ko.observable(undefined);
        this.masterVM.lapVM.selectedLap = ko.observable(undefined);

        var self = this;

        // Maybe: set rawdata on masterVM
        this.masterVM.sessionVM.setRawdata = function(self,rawData)
        {
            self.masterVM.sessionVM.rawData = rawData;
        }


        this.masterVM.lapVM.setRawdata = function (self, rawData) {
            self.masterVM.lapVM.rawData = rawData;
        }

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

            self.showChartsDatetime(VM.rawData, start_time, timestamp, sport);


        }


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

            self.showChartsDatetime(VM.rawData, start_time, timestamp,sport);


        }


        ko.applyBindings(this.masterVM, bodyElement); // Initialize master model with DOM 
        jqueryBodyElement.show();

        // Initialize map
        if (this.map === undefined)
            this.map = this.initMap();

    }


    function FITUIUtility() {
    }


    UIController.prototype.showSpeedVsHeartRate = function (rawData) {
        var seriesSpeedVsHR = [];
        var minLength;

        if (rawData["heart_rate"] === undefined || rawData["heart_rate"] === null)
            return;

        if (rawData["speed"] === undefined || rawData["speed"] === null)
            return;

        if (rawData["heart_rate"].length === 0)
            return;

        if (rawData["speed"].length === 0)
            return;

        var hrLength = rawData["heart_rate"].length;
        var speedLength = rawData["speed"].length;

        if (hrLength >= speedLength) // Arrays could be of different sizes, cut off
            minLength = speedLength;
        else
            minLength = hrLength;


        var myZones = getHRZones();

        for (var datap = 0; datap < minLength; datap++) {
            var speedx = rawData["speed"][datap][1];
            var hry = rawData["heart_rate"][datap][1];
            if (speedx === undefined || hry === undefined)
                console.error("Could not access raw data for data point nr. " + datap.toString());
            else {
                seriesSpeedVsHR.push([speedx, hry]);

                // Count Heart rate data points in zone
                for (var zone = 0; zone < myZones.length; zone++) {
                    if (hry <= myZones[zone].max && hry >= myZones[zone].min)
                        if (myZones[zone].count === undefined)
                            myZones[zone].count = 1
                        else
                            myZones[zone].count++;
                }


            }
        }

        var divChart = document.getElementById("speedVsHRChart");
        divChart.style.visibility = "visible";

        var chart2 = new Highcharts.Chart({
            chart: {
                renderTo: 'speedVsHRChart',
                type: 'line'
            },
            title: {
                text: ''
            },
            xAxis: {

                //categories : ['Apples', 'Bananas', 'Oranges']
                //type : 'datetime'
            },
            yAxis: {
                title: {
                    text: 'bpm'
                }
            },

            series: [{ name: 'Speed vs Heart Rate', data: seriesSpeedVsHR }]

        });

    };

    FITUIUtility.prototype.hasGPSData = function (rawdata) {
        if (rawdata.record.position_lat === undefined) {
            console.info("No position data (position_lat)");
            
        }

        if (rawdata.record.position_long === undefined) {
            console.info("No position data (position_lat)");
            
        }

        return (rawdata.record.position_lat === undefined || rawdata.record.position_long === undefined) ? false : true;

    }

    FITUIUtility.prototype.combine = function (rawdata,values, timestamps,startTimestamp,endTimestamp, converter, seriesName) {
        var util = FITUtility();
        var combined = [];

        if (timestamps == undefined) {
            console.warn("Found no timestamps to combine with data measurements.",seriesName);
            return values;
        }

        if (values.length !== timestamps.length)
            console.warn("Length of arrays to combine is not of same size; values length = " + values.length.toString() + " timestamp length = " + timestamps.length.toString(),seriesName);

        
        if (startTimestamp === undefined || endTimestamp === undefined) {
            console.error("Either startTimestamp or endTimestamp is undefined, cannot continue, array not combined with timestamps, series:",seriesName);
            return values;
            // But, could perhaps add relative start time...?
        }


        
       
        for (var nr = 0; nr <= timestamps.length; nr++) {
            
            var timestamp = timestamps[nr];
            if (rawdata.dirty[nr]) // Skip dirty data
                continue;
            
            if (timestamp >= startTimestamp && timestamp <= endTimestamp) {
                if (values[nr] !== undefined) {
                    if (converter)
                        combined.push([util.addTimezoneOffsetToUTC(timestamps[nr]), converter(values[nr])]);
                    else
                        combined.push([util.addTimezoneOffsetToUTC(timestamps[nr]), values[nr]]);
                }
                else
                    console.log("Tried to combine timestamp ", timestamp, " with undefined value at index", nr," series: ",seriesName);
            }
                if (timestamp > endTimestamp)
                break;
           
        }

        return combined;
      
    }

    FITUIUtility.prototype.setDirtyTimestamps = function(rawdata,timestamps) {

        if (typeof (timestamps) === "undefined") {
            console.error("No timestamps - undefined");
            return undefined;
        }

        if (timestamps.length === 0) {
            console.warn("Empty timestamps");
            return undefined;
        }

        rawdata.dirty = [];

       
        var max = 1000*60*24;
        var oneWeek = 1000 * 60 * 24 * 7;
      
        var len = timestamps.length;
        var timeDiff;

        var start_time = timestamps[0];
        var maxLimit = start_time+oneWeek;
        
        for (var index = 0; index < len; index++) {
            if (index + 1 <= len - 1) {
                timeDiff = timestamps[index + 1] - timestamps[index];
                if (timeDiff > 0 && timeDiff < max && timestamps[index] < maxLimit)
                    rawdata.dirty[index] = false;
                else {
                    console.warn("Found dirty timestamp ", timestamps[index], " at index ", index);
                    rawdata.dirty[index] = true;
                }
            } else  // Last timestap
            {
                if (timestamps[index] < maxLimit)
                    rawdata.dirty[index] = false;
                else {
                    console.warn("Found dirty timestamp ", timestamps[index], " at index ", index);
                    rawdata.dirty[index] = true;
                }
            }
        }

        
    }

    FITUIUtility.prototype.restoreSession = function (rawData) {
        var prevSession = rawData.session;
        
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
            var currentSport;
            var prevSport;
            var lastEndtimstamp;
            var total_elapsed_time;
            var total_timer_time;
            var total_distance;
            var total_calories;


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
                    rawData.session.start_time.push(rawData.lap.start_time[lapNr])


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

            rawData.session.sport.push(0);
           
            var lastRecordIndex = rawData.record.timestamp.length - 1;
            
            var timestamp = rawData.record.timestamp[lastRecordIndex];
            rawData.session.timestamp.push(timestamp);

            var start_time = rawData.record.timestamp[0];
            rawData.session.start_time.push(start_time);

            var total_elapsed_time = (timestamp-start_time)/1000;
            if (total_elapsed_time && total_elapsed_time >= 0) {
                rawData.session.total_elapsed_time.push(total_elapsed_time);
                rawData.session.total_timer_time.push(total_elapsed_time);
            }
            else
                console.error("Something is wrong with start and/or end timestamp", start_time, timestamp);

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

           // TO DO : calculate avg./max for speed, HR, ... not prioritized

        }

        return rawData.session;
    }

    FITUIUtility.prototype.getIndexOfTimestamp = function (record, timestamp) {


        var findNearestTimestamp = function (timestamp) {

            // Try to get from cache first

            for (var cacheItem = 0; cacheItem < FITUI.timestampIndexCache.length; cacheItem++)
                if (FITUI.timestampIndexCache[cacheItem].key === timestamp)
                    return FITUI.timestampIndexCache[cacheItem].value;


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
                FITUI.timestampIndexCache.push({ key: timestamp, value: indxNr });
                return indxNr;
            }
            else {
                FITUI.timestampIndexCache.push({ key: timestamp, value: indxNr - 1 });
                return indxNr - 1;
            }
        };

        if (timestamp === undefined) {
            console.error("Cannot lookup/find index in timestamp array of an undefined timestamp");
            return -1;
        }

        var indexTimestamp;

        indexTimestamp = record.timestamp.indexOf(timestamp);
        if (indexTimestamp === -1) {
            console.warn("Direct lookup for timestamp ", timestamp, " not found, looping through available timestamps on message property record.timestamp to find nearest");
            indexTimestamp = findNearestTimestamp(timestamp);
        }

        return indexTimestamp;

    }

    FITUIUtility.prototype.convertSpeedToMinutes = function (speed) {
        // speed in m/s to min/km
        if (speed === 0)
            return 0;
        else 
          return 1 / (speed * 60 / 1000);
    }

    FITUIUtility.prototype.convertSpeedToKMprH = function (speed) {
        // raw speed in m/s to km/h
        if (speed === 0)
            return 0;
        else
            return speed * 3.6; // 3.6 = 3600 s/h / 1000 m/km
    }

    UIController.prototype.addLapLines = function (rawData, chart) {
        // Add lap plotlines
        //
        // Would like to have the ability to write images at bottom/top of plotlines (to show lap triggers),
        // but label property doesnt support image. In the case line is rendered using SVG
        // line coordinates can be accessed via FITUI.multiChart.xAxis[0].plotLinesAndBands[0].svgElem.d

        //var self = this;

        var axis = chart.xAxis[0];

        var util = FITUtility();

        this.formatToMMSS = function (speed) {
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
        }

        var lapLinesConfig = [];


        var lapLabel;
        if (rawData.lap) {
            for (var lapNr = 0, len = rawData.lap.timestamp.length ; lapNr < len; lapNr++) {
                if (rawData.lap.timestamp && rawData.lap.timestamp[lapNr]) {
                    switch (rawData.lap.lap_trigger[lapNr]) {
                        case 0:  // LAP pressed
                        case 2: // Distance
                        case 7: // Session end
                            lapLabel = ""


                            if (rawData.lap.avg_speed && rawData.lap.avg_speed[lapNr]) {
                                switch (this.masterVM.speedMode()) {
                                    case 1: // Running
                                        lapLabel += " " + this.formatToMMSS(FITUtil.convertSpeedToMinutes(rawData.lap.avg_speed[lapNr]));
                                        break;
                                    case 2: // Cycling
                                        lapLabel += " " + FITUtil.convertSpeedToKMprH(rawData.lap.avg_speed[lapNr]).toFixed(1);
                                        break;

                                    default:
                                        lapLabel += " " + FITUtil.convertSpeedToKMprH(rawData.lap.avg_speed[lapNr]).toFixed(1);
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
                    console.warn("No timestamps for lap in rawdata to lay out lap lines");

                lapLinesConfig[lapNr] = {
                    id: 'plotLines', // + lapNr.toString(), - having the same id allows removal of all lines at once 

                    dashStyle: 'Dash',
                    //color: '#960000',
                    color : 'lightgray',
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
                    value: util.addTimezoneOffsetToUTC(rawData.lap.timestamp[lapNr])
                };
            }
        }

        for (var lapNr = 0; lapNr < lapLinesConfig.length; lapNr++) {
            axis.addPlotLine(lapLinesConfig[lapNr]);
        }
        
    }

    UIController.prototype.showLapChart = function(rawdata, startTimestamp, endTimestamp, sport)
    {
        // Clean up previous chart if any
        if (this.lapChart)
            this.lapChart.destroy();

        // Check for empty lap info.

        if (typeof (rawdata.lap) === "undefined" || rawdata.lap.timestamp.length === 0) {
            console.log("No lap data to show chart for");
            return;
        }

        

        this.lapChart = new Highcharts.Chart({
            chart: {
                renderTo: 'lapChart',
                type: 'bar',
                
            },
            title: {
                text: null,
            },
            credits: {
                enabled: false
            },
            //plotOptions: {
            //    bar: {
            //        grouping: false,
            //        shadow: false
            //    }
            //},
            xAxis: {
                categories: lap.categories
            },
            yAxis: [{
                gridLineWidth: 0,
                title: {
                    text: null
                }
            },
            {
                gridLineWidth: 0,
                title: {
                    text: null
                }
                    
            }],
           
            //legend: {
            //    layout: 'vertical',
            //    floating: true,
            //    backgroundColor: '#FFFFFF',
            //    align: 'right',
            //    verticalAlign: 'top',
            //    y: 60,
            //    x: -60
            //},
            tooltip: {
                formatter: function () {
                    return '<b>' + this.series.name + '</b><br/>' +  this.x + ': ' + this.y;
                }
            },
            plotOptions: {
            },
            series: [{
                yAxis: 0,
                name : 'Avg. speed',
                data: lap.avg_speed
            },
            {
                yAxis: 0,
                name : 'Max. speed',
                data: lap.max_speed,
                visible : false,
            },
            {
                yAxis: 1,
                name : 'Avg. HR',
                data: lap.avg_heart_rate,
                visible : false,
            },
            {
                yAxis: 1,
                name: 'Max. HR',
                visible : false,
                data: lap.max_heart_rate
            }

            ]
        });
    }

    UIController.prototype.showChartsDatetime = function (rawData, startTimestamp, endTimestamp, sport) {

       // this.showLapChart(rawData, startTimestamp, endTimestamp, sport);

        // http://api.highcharts.com/highcharts#Chart.destroy()
        if (this.multiChart)
            this.multiChart.destroy();

        var self = this;
        var util = FITUtility();
       

        var chartId = "testChart";
        var divChart = document.getElementById(chartId);
        divChart.style.visibility = "visible";
        var seriesSetup = []; // Options name,id
        var seriesData = []; // Actual data in chart
        var heartRateSeries;
        var heartRateSeriesData;
        var altitudeSeries;
        var altitudeSeriesData;
        var speedSeries;
        var speedSeriesData;
        var cadenceSeries
        var cadenceSeriesData;
        var powerSeries
        var powerSeriesData;
        var temperatureSeries
        var temperatureSeriesData;

        var prevMarker = null; // Holds previous marker for tracking position during mouse move/over

        var allRawdata = rawData;

        

        // Record data

        var yAxisNr = 0; // Give each series a y-axis
        var yAxisOptions = [];
        var speedYAxisNr;
        var heartRateYAxisNr;

        var id;

        if (rawData.record) {

            if (rawData.record.heart_rate) {
                id = 'heartrateseries';
                heartRateSeriesData = FITUtil.combine(rawData,rawData.record.heart_rate, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                seriesData[id] = heartRateSeriesData;
                heartRateYAxisNr = yAxisNr;
                heartRateSeries = {
                    id: id,
                    name: 'Heart rate',
                    yAxis: yAxisNr++,
                    type: 'line',
                    data: seriesData[id],
                    zIndex : 100,
                };
                seriesSetup.push(heartRateSeries);
                yAxisOptions.push({
                    gridLineWidth: 1,
                    title: {
                        text: null
                    }
                    
                });

            }

           

            this.masterVM.speedMode(undefined);

            if (rawData.record.speed) {
                id = 'speedseries';
               
                if (FITUI.masterVM.settingsVM.forceSpeedKMprH()) 
                    sport = 0;
                

                switch (sport) {
                    case 1: // Running
                        this.masterVM.speedMode(1); // min/km
                        speedSeriesData = FITUtil.combine(rawData,rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToMinutes,id);
                        break;
                    case 2: // Cycling
                        this.masterVM.speedMode(2); // km/h
                        speedSeriesData = FITUtil.combine(rawData,rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToKMprH, id);
                        break;
                    default:
                        this.masterVM.speedMode(2);
                        speedSeriesData = FITUtil.combine(rawData,rawData.record.speed, rawData.record.timestamp, startTimestamp, endTimestamp, FITUtil.convertSpeedToKMprH, id);
                        break;
                }
                seriesData[id] = speedSeriesData;
                speedYAxisNr = yAxisNr;
                speedSeries = { name: 'Speed', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex: 99 };
               seriesSetup.push(speedSeries);
               yAxisOptions.push({
                   gridLineWidth: 0,
                   title: {
                       text: null
                   },
                   opposite: true,
                  

               });
            }


            
            
            if (rawData.record.power) {
                id = 'powerseries';
                powerSeriesData = FITUtil.combine(rawData,rawData.record.power, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                seriesData[id] = powerSeriesData;

                powerSeries = { name: 'Power', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex: 98 };
                seriesSetup.push(powerSeries);
                yAxisOptions.push({
                    gridLineWidth: 0,
                    title: {
                        text: null
                    },
                    opposite: true,
                   

                });
            }

            if (rawData.record.cadence) {
                id = 'cadenceseries';
                cadenceSeriesData = FITUtil.combine(rawData, rawData.record.cadence, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                seriesData[id] = cadenceSeriesData;

                cadenceSeries = { name: 'Cadence', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex : 97 };

                seriesSetup.push(cadenceSeries);
                yAxisOptions.push({
                    gridLineWidth: 0,
                    title: {
                        text: null
                    }

                });

            }
            
            if (rawData.record.altitude) {
                id = 'altitudeseries';
                 altitudeSeriesData = FITUtil.combine(rawData,rawData.record.altitude, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                 seriesData[id] = altitudeSeriesData;
                 var hasGPSdata = FITUtil.hasGPSData(rawData);
                 altitudeSeries = {
                     name: 'Altitude', id: id, yAxis: yAxisNr++, data: seriesData[id], visible: hasGPSdata, type: 'line', zIndex: 96 };
              
                seriesSetup.push(altitudeSeries);
                yAxisOptions.push({
                    gridLineWidth: 0,
                    title: {
                        text: null
                    }

                });
            }


            if (rawData.record.temperature) {
                id = 'temperatureseries';
                temperatureSeriesData = FITUtil.combine(rawData,rawData.record.temperature, rawData.record.timestamp, startTimestamp, endTimestamp, undefined, id);
                seriesData[id] = temperatureSeriesData;
                temperatureSeries = { name: 'Temperature', id: id, yAxis: yAxisNr++, data: seriesData[id], type: 'line', zIndex: 95 };
                seriesSetup.push(temperatureSeries);
                yAxisOptions.push({
                    gridLineWidth: 0,
                    opposite : true,
                    title: {
                        text: null
                    }
                   

                });
            }
            
        }

        // Setup lap categories
        var len = rawData.lap.timestamp.length;
        var lap = {
            categories: [],
            avg_speed: [],
            max_speed: [],
            avg_heart_rate: [],
            max_heart_rate: []
        }

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

                console.warn("Found no lap." + property + " in rawdata");
                return undefined;
            }
        }

        for (lapNr = 0; lapNr < len; lapNr++) {
            if (rawData.lap.start_time[lapNr] >= startTimestamp && rawData.lap.timestamp[lapNr] <= endTimestamp) {
                lap.categories.push((lapNr + 1).toString());
                switch (sport) {
                    case 1: // Running
                        pushData("avg_speed", FITUtil.convertSpeedToMinutes);
                        pushData("max_speed", FITUtil.convertSpeedToMinutes);
                        pushData("avg_heart_rate");
                        pushData("max_heart_rate");
                        break;
                    case 2: // Cycling
                        pushData("avg_speed", FITUtil.convertSpeedToKMprH);
                        pushData("max_speed", FITUtil.convertSpeedToKMprH);
                        pushData("avg_heart_rate");
                        pushData("max_heart_rate");
                        break;
                    default:
                        pushData("avg_speed", FITUtil.convertSpeedToKMprH);
                        pushData("max_speed", FITUtil.convertSpeedToKMprH);
                        pushData("avg_heart_rate");
                        pushData("max_heart_rate");
                        break;
                }
              
               
            }
        }

       
        seriesSetup.push({ name: "Avg. speed", id: 'LAP_avg_speed', xAxis: 1, yAxis: speedYAxisNr, data: lap.avg_speed, type: 'column', visible : true, zIndex : 1 });
        seriesSetup.push({ name: "Max. speed", id: 'LAP_max_speed', xAxis: 1, yAxis: speedYAxisNr, data: lap.max_speed, type: 'column', visible: false, zIndex: 1 });
        seriesSetup.push({ name: "Avg. HR", id: 'LAP_avg_heart_rate', xAxis: 1, yAxis: heartRateYAxisNr, data: lap.avg_heart_rate, type: 'column', visible: false, zIndex: 1 });
        seriesSetup.push({ name: "Max. HR", id: 'LAP max_heart_rate', xAxis: 1, yAxis: heartRateYAxisNr, data: lap.max_heart_rate, type: 'column', visible: false, zIndex: 1 });

        var xAxisType = 'datetime';

        var chartOptions = {
            animation : false,
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
        console.log("Starting highchart now " + d);
        
            
       

        this.multiChart = new Highcharts.Chart({
            chart: chartOptions,
            //height : 700,
            
            title: {
                text: ''
            },
            xAxis: [{
                id: 'dataxAxis',
                type: xAxisType,
                events: {
                    afterSetExtremes: function (event) {
                        // Remember x-axis is local time, but rawdata is accessed by UTC
                        // Highchart "reset zoom"-button fires here with values on event.min/max (setExtremes gave undefined)
                        timezoneDiff = util.getTimezoneOffsetFromUTC();
                        //console.log("afterSetExtremes xAxis in multiChart min, max =  ", event.min, event.max);
                        var startTimestampUTC = Math.round(event.min)-timezoneDiff;
                        var endTimestampUTC = Math.round(event.max)-timezoneDiff;
                        self.showHRZones(allRawdata, startTimestampUTC, endTimestampUTC);
                    }

                    //setExtremes: function (event) {
                    //    console.log("setExtremes xAxis in multiChart min, max =  ", event.min, event.max);
                    //}
                }
                //plotLines: lapLinesConfig
                //reversed : true
            },{
                type: 'linear',
                id : 'lapxAxis',
                categories : lap.categories}],
            //yAxis: [{
            //    title: {
            //        text: null
            //    }
            //    //labels: {
            //    //    formatter: function () {
            //    //        if (self.speedMode === 1) // Running
            //    //            return self.formatToMMSS(this.value) + " min/km";
            //    //        else if (self.speedMode === 2) // Cycling
            //    //            return this.value + "km/h";
            //    //        else
            //    //            return this.value;
            //    //    }
            //    //}
            //}, { // Secondary yAxis
            //    gridLineWidth: 0,
            //    title: {
            //        text: null,
            //        //style: {
            //        //    color: '#4572A7'
            //        //}
            //    },
            //    labels: {
            //        //formatter: function() {
            //        //    return this.value +' mm';
            //        //},
            //        //style: {
            //        //    color: '#4572A7'
            //        //}
            //    }
            //},
            yAxis : yAxisOptions,

            legend: {
                enabled: this.masterVM.settingsVM.showLegends()
            },

            tooltip: {
                //xDateFormat: '%Y-%m-%d',
                formatter:

                    function () {

                        //http://stackoverflow.com/questions/3885817/how-to-check-if-a-number-is-float-or-integer
                        function isInt(n) {
                            return n % 1 === 0;
                        }

                        var onLapxAxis;
                        (this.series.xAxis === self.multiChart.get('lapxAxis')) ? onLapxAxis = true : onLapxAxis = false;
                        // Check to see if its a tooltip for lap axis
                        if (onLapxAxis) {
                            var lapNr = this.x;
                            s = "Lap " + lapNr.toString();
                            if (rawData.lap.total_distance)
                                 s += '<br/>' + '<b>Distance:</b> ' + Highcharts.numberFormat(rawData.lap.total_distance[lapNr - 1],0) + ' m';
                        }
                        else
                            s = Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x);
                        

                        s += '<br/>' + '<b>' + this.series.name + '</b>' + ': ';

                        // Special treatment for speed
                        if (self.masterVM.speedMode() && this.series.name === "Speed" || this.series.name === "Avg. speed" || this.series.name === "Max. speed")
                            switch (self.masterVM.speedMode()) {
                                case 1: // Running
                                    s += self.formatToMMSS(this.y) + " min/km";
                                    break;
                                case 2: // Cycling
                                    s += Highcharts.numberFormat(this.y, 1) + " km/h";
                                    break;
                                default:
                                    s += Highcharts.numberFormat(this.y, 1) + " km/h";
                                    break;
                            }
                        else {
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
                series: {
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

                            select: function () {
                                console.log(Highcharts.dateFormat('%Y-%m-%d %H:%M:%S', this.x), this.y)
                            },

                            mouseOver: function () {
                                var lat, long;

                                if (rawData.record != undefined) {
                                    
                                    var index = rawData.record.timestamp.indexOf(this.x-util.getTimezoneOffsetFromUTC());
                                  

                                    if (index === -1) {
                                        console.error("Could not find index of timestamp ", this.x);
                                        return;
                                    }

                                    setMarker = function () {
                                        if (typeof (google) === "undefined") // Allows working without map
                                            return;

                                        prevMarker = new google.maps.Marker({
                                            position: new google.maps.LatLng(util.semiCirclesToDegrees(lat), util.semiCirclesToDegrees(long)),
                                            icon: {
                                                path: google.maps.SymbolPath.CIRCLE,
                                                scale: 3
                                            },
                                            draggable: true,
                                            map: self.map
                                        });
                                    }

                                    if (rawData.record.position_lat != undefined)
                                        lat = rawData.record.position_lat[index];

                                    if (rawData.record.position_long != undefined)
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
                            },

                            mouseOut: function () {
                                if (prevMarker !== undefined && prevMarker !== null) {
                                    prevMarker.setMap(null);
                                    prevMarker = null; // GC takes over...
                                }
                            }
                        }

                    }
                }
            }
            ,

            series: seriesSetup,

           



        }


            //, function () {
            ////callback action
            //alert('Something is happening now....');
    //    }
    );

       // var test = chart1.get('heartrateseries');

        var divLoadingId = '#liLoad';
        var jquerydivLoadingElement = $(divLoadingId);
        var divLoadingElement = jquerydivLoadingElement[0];
        console.log(divLoadingId + " for data binding ", divLoadingElement);

        
        //if (FITUI.loadChartVM === undefined) {

        //    //FITUI.masterVM.loadChartVM = new loadSeriesViaButtonViewModel(FITUI.multiChart, seriesData);
        //   // ko.applyBindings(FITUI.loadChartVM, divLoadingElement);
           
        //} else

            jquerydivLoadingElement.show();
            this.masterVM.loadChartVM.setNewChartAndSeriesData(this.multiChart, seriesData);

           

            if (this.masterVM.settingsVM.showLapLines())
                this.addLapLines(rawData, this.multiChart,false);

        //chart1.showLoading();
        // http://api.highcharts.com/highcharts#Series.setData()

       //     if (seriesData['heartrateseries'])
       //     this.multiChart.addSeries({
       //         name : 'Heart rate',
       //         id: 'heartrateseries',
       //         yaxis : 0,
       //         data: seriesData['heartrateseries']}); // Choose heart rate series as default

       // if (seriesData['speedseries'])
       //     this.multiChart.addSeries({
       //         name : 'Speed',
       //         id: 'speedseries',
       //         yAxis : 1,
       //         data: seriesData['speedseries']
       //     }); // Next, try speed

       //if (seriesData['altitudeseries'])
       //     this.multiChart.addSeries({
       //         name : 'Altitude',
       //         id: 'altitudeseries',
       //         yAxis : 2,
       //         data : seriesData['altitudeseries']}); // Next, try altitude
       
       
        d = new Date();
        console.log("Finishing highcharts now " + d);


        //FITUI.showSpeedVsHeartRate(rawData);

       


    };


    UIController.prototype.showDeviceInfo = function (rawdata) {
        var util = FITUtility();  // Move to FITUI as property??

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

        if (typeof (rawdata) === "undefined") {
            console.error("No rawdata available");
            return;
        }

        if (typeof (rawdata.device_info) === "undefined") {
            console.error("No device information");
            return;
        }

        var deviceInfoLen = rawdata.device_info.timestamp.length;

        if (typeof (deviceInfoLen) === "undefined" || deviceInfoLen === 0) {
            console.error("No timestamp information in device_info, device_info.timestamp");
            return;
        }

        var xpos, ypos;
        var srcImgDeviceInfo, titleDeviceInfo;
        var SVGDeviceInfoElement;

        var plotLeft = this.multiChart.plotLeft;
        var renderer = this.multiChart.renderer;
        var width = this.multiChart.xAxis[0].width;
        var extremes = this.multiChart.xAxis[0].getExtremes();
        var max = this.multiChart.xAxis[0].max
        var min = this.multiChart.xAxis[0].min;
       
        console.log("Deviceinfo xaxis extreemes datamin,datamax : ", min, max);

        this.removeSVGGroup(this.masterVM.deviceInfoGroup);
        this.masterVM.deviceInfoGroup = renderer.g('deviceinfo').add();


        var type, manufact, product;
        
       
        
        if (typeof (this.masterVM.freeYPOS) === "undefined")
            this.masterVM.freeYPOS = {};

        var waitForDelay = 3 * 60 * 1000;

        var recLen = rawdata.record.timestamp.length;
        var maxTimestamp = util.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);

        for (var deviceInfoNr = 0; deviceInfoNr < deviceInfoLen; deviceInfoNr++) {
            var timestamp = util.addTimezoneOffsetToUTC(rawdata.device_info.timestamp[deviceInfoNr]);

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
                titleDeviceInfo = "Manufacturer : Garmin"
            else if (manufact)
                titleDeviceInfo = "Manufacturer : " + manufact.toString();
            if (product)
              titleDeviceInfo =  titleDeviceInfo+" Product :" + product.toString();
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
                        titleDeviceInfo = "FR610";
                        break;
                    case garmin_product.fr405:
                        srcImgDeviceInfo = "Images/deviceinfo/garmin/405.jpg";
                        titleDeviceInfo = "FR610";
                        break;
                    case garmin_product.fr110:
                        srcImgDeviceInfo = "Images/deviceinfo/garmin/fr110.png";
                        titleDeviceInfo = "FR110";
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

                    //default:
                    //    srcImgDeviceInfo = "Images/deviceinfo/unknown.jpg";
                    //    titleDeviceInfo = "Product :" + product.toString();
                    //    break;
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
                titleDeviceInfo = "Footpod (stride/speed/distance)"
            }


            if (type === device_type.bike_power) {
                srcImgDeviceInfo = "Images/power.png";
                titleDeviceInfo = "Bike power"
            }

            if (type === device_type.environment_sensor_legacy && typeof (product) === "undefined" && typeof (manufact) === "undefined") {
                srcImgDeviceInfo = "Images/deviceinfo/env_sensor_legacy.png";
                titleDeviceInfo = "Barometre/Temperature sensor"
            }

            if (type === device_type.environment_sensor_legacy && typeof(product) === "undefined"  && manufact === manufacturer.garmin) {
                srcImgDeviceInfo = "Images/deviceinfo/env_sensor_legacy.png";
                titleDeviceInfo = "Accelerometre"
            }

            titleDeviceInfo += " "
            if (rawdata.device_info.software_version[deviceInfoNr])
                titleDeviceInfo += "Firmware : " + rawdata.device_info.software_version[deviceInfoNr].toString();
            if (rawdata.device_info.serial_number[deviceInfoNr])
                titleDeviceInfo += " Serial number : " + rawdata.device_info.serial_number[deviceInfoNr].toString();

            
           
            if (srcImgDeviceInfo !== undefined) {
                SVGDeviceInfoElement = renderer.image(srcImgDeviceInfo, xpos, this.masterVM.freeYPOS[timestamp], 16, 16).add(this.masterVM.deviceInfoGroup);
                if (titleDeviceInfo)
                    SVGDeviceInfoElement.attr({ title: titleDeviceInfo });
                srcImgDeviceInfo = undefined;
                titleDeviceInfo = undefined;
            } 

            previousTimestamp = timestamp;
        }


    }
    

    UIController.prototype.showEvents = function(rawdata)
    {
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
            timer : 0, // Group 0. Start / stop_all
            workout : 3, //  start / stop
            workout_step : 4, //  Start at beginning of workout. Stop at end of each step.
            power_down : 5, // stop_all group 0
            power_up : 6, //  stop_all group 0
            off_course : 7, // start / stop group 0
            session : 8, // Stop at end of each session.
            lap : 9, //  Stop at end of each lap.
            course_point : 10, // marker.
            battery : 11, // marker.
            virtual_partner_pace : 12, //  Group 1. Start at beginning of activity if VP enabled, when VP pace is changed during activity or VP enabled mid activity. stop_disable when VP disabled.
            hr_high_alert : 13, // Group 0. Start / stop when in alert condition.
            hr_low_alert : 14, //  Group 0. Start / stop when in alert condition.
            speed_high_alert : 15, // Group 0. Start / stop when in alert condition.
            speed_low_alert : 16, //  Group 0. Start / stop when in alert condition.
            cad_high_alert : 17, //    Group 0. Start / stop when in alert condition.
            cad_low_alert : 18, //   Group 0. Start / stop when in alert condition.
            power_high_alert : 19, //  Group 0. Start / stop when in alert condition.
            power_low_alert : 20, //   Group 0. Start / stop when in alert condition.
            recovery_hr : 21, //  marker.
            battery_low : 22, // marker.
            time_duration_alert : 23, //    Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
            distance_duration_alert : 24, // Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
            calorie_duration_alert : 25, // Group 1. Start if enabled mid activity (not required at start of activity). Stop when duration is reached. stop_disable if disabled.
            activity : 26, // Group 1.. Stop at end of activity.
            fitness_equipment : 27, // marker.
            length : 28 // Stop at end of each length.
        };


    var util = FITUtility();  // Move to FITUI as property??

    if (typeof (rawdata) === "undefined") {
        console.error("No rawdata available");
        return;
    }

    if (typeof(rawdata.event) === "undefined")
    {
        console.error("No event information");
        return;
    }

    var eventLen = rawdata.event.timestamp.length;

    if (typeof (eventLen) === "undefined" || eventLen === 0) {
        console.error("No timestamp information from event, event.timestamp");
        return;
    }

    var eventIndex = 0;
    var xpos, ypos;
    var plotLeft = this.multiChart.plotLeft;
    var renderer = this.multiChart.renderer;
    var width = this.multiChart.xAxis[0].width;
    var extremes = this.multiChart.xAxis[0].getExtremes();
    var max = this.multiChart.xAxis[0].max;
    var min = this.multiChart.xAxis[0].min;

    console.log("Event xaxis extremes datamin,datamax : ", min, max);

    var srcImgEvent, titleEvent;
    var SVGeventElement;
    
    

    this.removeSVGGroup(this.masterVM.eventGroup);

    this.masterVM.eventGroup = renderer.g('events').add();

    if (typeof (this.masterVM.freeYPOS) === "undefined")
        this.masterVM.freeYPOS = {};

    var waitForDelay = 3 * 60 * 1000;

    var recLen = rawdata.record.timestamp.length;
    var maxTimestamp = util.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);

    for (var eventNr = 0; eventNr < eventLen; eventNr++) {
        var timestamp = util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]);

        if (timestamp < min)
            continue;

        if (timestamp > maxTimestamp+waitForDelay || timestamp > max)
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

        srcImgEvent = "Images/event/unknown.png"
        titleEvent = "Event: "+ev.toString()+" Event type: " + ev_type.toString();

        switch (ev) {
            case event.timer:

                switch (ev_type) {
                    case event_type.start:
                        srcImgEvent = "Images/event_type/start_0.png";
                        titleEvent = "START";
                        titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                        break;
                    case event_type.stop:
                        srcImgEvent = "Images/event_type/stop_all_4.png";
                        titleEvent = "STOP";
                        titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                        break;
                    case event_type.stop_all:
                        srcImgEvent = "Images/event_type/stop_all_4.png";
                        titleEvent = "STOP ALL";
                        titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                        break;
                    case event_type.stop_disable:
                        srcImgEvent = "Images/event_type/stop_all_4.png";
                        titleEvent = "STOP DISABLE";
                        titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                        break;
                    case event_type.stop_disable_all:
                        srcImgEvent = "Images/event_type/stop_disable_all9.png";
                        titleEvent = "STOP DISABLE ALL";
                        titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                        break;

                }
                break;


            case event.battery: // Don't check for event_type marker
                srcImgEvent = "Images/event/battery_marker.png";
                titleEvent = "Battery";
                if (rawdata.event.data[eventNr])
                    titleEvent += " - " + rawdata.event.data[eventNr].toString();
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;

            case event.recovery_hr: // Don't check for event type marker
                srcImgEvent = "Images/heart.png";
                titleEvent = "Recovery HR";
                titleEvent += " "+ Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));

                if (rawdata.event.data[eventNr])
                    titleEvent += " - " + rawdata.event.data[eventNr].toString();
                break;

            case event.battery_low: 
                srcImgEvent = "Images/event/battery-low.png";
                titleEvent = "Battery low";
                if (rawdata.event.data[eventNr])
                    titleEvent += " - " + rawdata.event.data[eventNr].toString();
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;

            case event.power_down:
                srcImgEvent = "Images/event/power_down.png";
                titleEvent = "Power down";
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;

            case event.power_up:
                srcImgEvent = "Images/event/power_up.png";
                titleEvent = "Power up";
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;
            
            case event.session:
                srcImgEvent = "Images/laptrigger/session_end.png";
                titleEvent = "Stop - end of session";
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;

            case event.course_point:
                srcImgEvent = "Images/laptrigger/position_marked.png";
                titleEvent = "Course point";
                titleEvent += " " + Highcharts.dateFormat('%H:%M:%S', util.addTimezoneOffsetToUTC(rawdata.event.timestamp[eventNr]));
                break;
           
        }

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

        
    }

    UIController.prototype.removeSVGGroup = function (SVG_group) {
        // Remove - http://stackoverflow.com/questions/6635995/remove-image-symbol-from-highchart-graph
        if (SVG_group)
            $(SVG_group.element).remove()

        this.masterVM.freeYPOS = {} // Loose state of ypos for triggers,deviceinfo,events in multichart
    }

    UIController.prototype.showLapTriggers = function(rawdata)
    {

        if (typeof (rawdata) === "undefined") {
            console.error("No rawdata, cannot show lap triggers");
            return;
        }

        var util = FITUtility();  // Move to FITUI as property??

      

        if (typeof(rawdata.lap) === "undefined")
        {
            console.error("No lap information");
            return;
        }

        var lapLen = rawdata.lap.timestamp.length;

        if (typeof (lapLen) === "undefined" || lapLen === 0) {
            console.error("No timestamp information from lap, lap.timestamp");
            return;
        }

        if (typeof (this.multiChart) === "undefined") {
            console.error("Multichart not defined");
            return;

        }

        var lapIndex = 0;
        var xpos, ypos;
        var plotLeft = this.multiChart.plotLeft;
        var renderer = this.multiChart.renderer;
        var width = this.multiChart.xAxis[0].width;
        var extremes = this.multiChart.xAxis[0].getExtremes();
        var max = this.multiChart.xAxis[0].max;
        var min = this.multiChart.xAxis[0].min;

        console.log("Lap triggers xaxis extremes datamin,datamax : ", min, max);

        var srcImg, title;
        var SVGE_elmImg;

        this.removeSVGGroup(this.masterVM.lapTriggerGroup);

        this.masterVM.lapTriggerGroup = renderer.g('laptriggers').add();

        if (typeof (this.masterVM.freeYPOS) === "undefined")  // Used for stacked layout
            this.masterVM.freeYPOS = {};

      
        var waitForDelay = 3 * 60 * 1000;

        var recLen = rawdata.record.timestamp.length;
        var maxTimestamp = util.addTimezoneOffsetToUTC(rawdata.record.timestamp[recLen - 1]);
        
        for (var lapNr = 0; lapNr < lapLen; lapNr++) {
            var timestamp = util.addTimezoneOffsetToUTC(rawdata.lap.timestamp[lapNr]);

            if (timestamp < min)
                continue;

            if (timestamp > maxTimestamp+waitForDelay || timestamp > max)
                break;


            if (timestamp <= max && timestamp >= min )
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
                    case 0:
                        srcImg = "Images/laptrigger/manual.png";
                        title = "LAP pressed";
                        break;
                    case 1:
                        srcImg = "Images/laptrigger/time.png";
                        title = "Time";
                        break;
                    case 2:
                        srcImg = "Images/laptrigger/distance.png";
                        title = "Distance";
                        break;
                    case 3:
                        srcImg = "Images/laptrigger/position_start.png";
                        title = "Position start";
                        break;
                    case 4:
                        srcImg = "Images/laptrigger/position_lap.png";
                        title = "Position lap";
                        break;
                    case 5:
                        srcImg = "Images/laptrigger/position_waypoint.png";
                        title = "Position waypoint";
                        break;
                    case 6:
                        srcImg = "Images/laptrigger/position_marked.png";
                        title = "Position marked";
                        break;
                    case 7:
                        srcImg = "Images/laptrigger/session_end.png";
                        title = "Session end";
                        break;
                    default:
                        srcImg = undefined;
                        title = undefined;
                }

                
                if (srcImg !== undefined) {
                    SVG_elmImg = renderer.image(srcImg, xpos, this.masterVM.freeYPOS[timestamp], 16, 16).add(this.masterVM.lapTriggerGroup);
                    if (title)
                        SVG_elmImg.attr({title: title});
                }
               
            }

        
    }

    UIController.prototype.showChartHrv = function (rawData) {
        var chartId = "hrvChart";
        var divChart = document.getElementById(chartId);
        //divChart.style.visibility = "visible";
        var seriesSetup = [];

        if (rawData.hrv !== undefined) {
            if (rawData.hrv.time !== undefined) {

                //chartType = 'bar';
                // Seems like line rendering is much faster than bar...
                //divChart.style.visibility = 'visible';
                divChart.style.display = 'block';
                seriesSetup.push({ name: 'Heart rate variability (RR-interval)', data: rawData.hrv.time });
            }

        }
        else {
            divChart.style.display = 'none';
            return;
        }

        var xAxisType = '';

        var chartOptions = {
            renderTo: chartId,
            type: 'line',
            // Allow zooming
            zoomType: 'xy'
        };


        var chart1 = new Highcharts.Chart({
            chart: chartOptions,
            title: {
                text: 'Heart rate variability'
            },
            xAxis: {
                //categories : ['Apples', 'Bananas', 'Oranges']
                type: xAxisType,
                //reversed : true
                events: {
                    setExtremes: function (event) {
                        console.log("setExtremes xAxis ", event.min, event.max);
                    }
                }
            },
            yAxis: {
                title: {
                    text: ''
                },
                events: {
                    setExtremes: function (event) {
                        console.log("setExtremes yAxis ", event.min, event.max);
                    }
                }
            },

            series: seriesSetup

        });


    };

    UIController.prototype.showHRZones = function (rawdata, startTimestamp, endTimestamp) {

        var divChartId = 'zonesChart';
        //var divChart = document.getElementById(divChartId);
       

        if (typeof (rawdata.record.heart_rate) === "undefined" || rawdata.record.heart_rate.length === 0) {
            console.warn("No HR data found, skipping HR Zones chart");
            //$('#zonesChart').hide();
            return;
        }

        //$('#zonesChart').show();
       

        if (FITUI.HRZonesChart)
            FITUI.HRZonesChart.destroy();

        

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
                    style: {
                        fontWeight: 'bold',
                        color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                    }
                }
            },
            legend: {
                enabled : false },
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
                formatter: function() {
                    return this.series.name + ': ' + Highcharts.numberFormat(this.y, 1);
                        
                }
            },
            plotOptions: {
                column: {
                    stacking: 'normal',
                    dataLabels: {
                        enabled: false,
                        color: (Highcharts.theme && Highcharts.theme.dataLabelsColor) || 'white'
                    }
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

        var startIndex = FITUtil.getIndexOfTimestamp(rawdata.record,startTimestamp);
        var endIndex = FITUtil.getIndexOfTimestamp(rawdata.record,endTimestamp);


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
                    console.error("Time in zone is NaN");
                    break;
                }

                if (timeInZoneMillisec > maxTimeDifference) {
                    console.warn("Greater than ", maxTimeDifference, "ms difference between timestamps, skipped (not calculated in HR zones)");
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
                console.error("Could not access heart rate raw data for record.timestamp " + rawdata.record.timestamp[datap].toString()+" at index "+datap.toString());
            else {
                // Count Heart rate data points in zone
                for (var zone = 0; zone < myZones.length; zone++) 
                    if (hry <= myZones[zone].max && hry >= myZones[zone].min) {

                        myZones[zone].timeInZone += timeInZoneMillisec;
                    //    console.log("HR ", hry, " time in zone", timeInZone, " zone ", zone, " total time (ms) ", myZones[zone].timeInZone);
                    }
             }
        }

        options.series = [];

        var timeInSecs;
        for (var catNr = myZones.length-1; catNr >= 0; catNr--) {
        
           // s1.data.push([myZones[catNr].name + " (" + myZones[catNr].min.toString() + "-" + myZones[catNr].max.toString() + ")", myZones[catNr].count / 60]);
           // timeInSecs = parseFloat(((myZones[catNr].timeInZone) / 60000).toFixed(1));
            
            timeInSecs = myZones[catNr].timeInZone / 60000;

            options.series.push({
                name: myZones[catNr].name ,
                data: [timeInSecs]
            });
        }

      
        FITUI.HRZonesChart = new Highcharts.Chart(options);
    }

    UIController.prototype.showSessionMarkers = function (map, rawdata) {
        // Plot markers for start of each session
        var self = this;

        var util = FITUtility();

        var sessionStartPosFound = false;

        var mapCenterSet = false;

        var session = rawdata.session;

        setMapCenter = function (sport,lat,long) {
            var latlong = new google.maps.LatLng(util.semiCirclesToDegrees(lat), util.semiCirclesToDegrees(long));
            console.info("Setting map center for sport ",sport," at ",latlong);
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
        if (self.sessionMarkers)
        {
            self.sessionMarkers.forEach(function (element, index, array) {
                element.setMap(null);
            });

            self.sessionMarkers = null;
        }

        if (session && session.start_position_lat)
            {
        
                session.start_position_lat.forEach(function (element, index, array) {

                    var lat = element;
                    var long = session.start_position_long[index];

                    if (lat  && long ) {
                    
                        sessionStartPosFound = true;
                        
                        setMapCenter(session.sport[index], lat, long);

                        mapCenterSet = true;

                        
                    }
                });
            }


        // Valid .FIT file have session record, but invalid fit may not....try to fetch from record head instead

        if (!sessionStartPosFound && rawdata.record)
            {
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
                    console.info("No start position was found in session data, got a position at start of record messages.", lat,long);
                    setMapCenter(sport, lat, long);
                    mapCenterSet = true;
                } else
                    console.warn("Got no start position from head/index 0 of position_lat/long");
            }

        return mapCenterSet;

    };

    UIController.prototype.showSessionsAsOverlay = function (map, rawdata) {
        var self = this;
        var util = FITUtility();

        var session = rawdata.session;

        // Remove previous overlays
        if (this.sessionRectangles !== undefined) {
            this.sessionRectangles.forEach(function (element, index, array) {
                self.sessionRectangles[index].setMap(null);
            });
        }

        if (session === undefined)
            return false;

        if (session.swc_lat === undefined || session.swc_long === undefined || session.nec_lat === undefined || session.nec_long === undefined) {
            console.info("No swc/nec data available in session");
            return false;
        }

    
        var sessionCoords = [];
        self.sessionRectangles = [];
        var fillColors = [];

        session.swc_lat.forEach(function (value, index, array) {

          
            if (session.swc_lat[index] &&
                session.swc_long[index] &&
                session.nec_lat[index] &&
                session.nec_long[index] ) {
                sessionCoords.push([
            new google.maps.LatLng(util.semiCirclesToDegrees(session.swc_lat[index]), util.semiCirclesToDegrees(session.swc_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.swc_lat[index]), util.semiCirclesToDegrees(session.nec_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.nec_lat[index]), util.semiCirclesToDegrees(session.nec_long[index])),
            new google.maps.LatLng(util.semiCirclesToDegrees(session.nec_lat[index]), util.semiCirclesToDegrees(session.swc_long[index]))]);
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

            self.sessionRectangles.push( new google.maps.Polygon({
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
    };

    UIController.prototype.initMap = function () {

        // f.ex in case google maps api is not downloaded due to network problems....
        // http://joshua-go.blogspot.no/2010/07/javascript-checking-for-undeclared-and.html

        if (typeof (google) === "undefined")
            return undefined;

        var myCurrentPosition, newMap;

        var mapOptions = {
            zoom: 11,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        newMap = new google.maps.Map(document.getElementById("activityMap"), mapOptions);


        if (navigator.geolocation) {
            // Async call with anonymous callback..
            navigator.geolocation.getCurrentPosition(function (position) {
                myCurrentPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
              var  currentCenter = newMap.getCenter();

                if (currentCenter === undefined)
                    newMap.setCenter(myCurrentPosition);
            });
        }

        return newMap;
    };

    UIController.prototype.showLaps = function (rawData) {


   this.divSessionLap.show();

            
    };

    UIController.prototype.showPolyline = function (rawdata,map, record, startTimestamp, endTimestamp, strokeOptions, type) {
      
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

        var self = this;

        

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
        else if (typeof (self.masterVM.activityPolyline) === "undefined")
             self.masterVM.activityPolyline = {};

        if (record === undefined) {
            console.info("No record msg. to based plot of polyline data for session,lap etc.");
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

        var util = FITUtility();

        // Build up polyline
        
            var latLength = record.position_lat.length;
            var longLength = record.position_long.length;

            console.info("Total GPS points available (position_lat,position_long) : ", latLength, longLength);
        
            //var sampleInterval = Math.floor(latLength / 30);

            //if (sampleInterval < 1)
            //    sampleInterval = 1;

            var sampleInterval = 2; // Max. sampling rate for 910XT is 1 second 

            console.info("Sample length for polyline is ", sampleInterval);

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

            var indexStartTime = FITUtil.getIndexOfTimestamp(record,startTimestamp);

            var indexEndTime = FITUtil.getIndexOfTimestamp(record,endTimestamp);
          

            for (var index = indexStartTime; index <= indexEndTime; index++) {
                if (index === indexStartTime || (index % sampleInterval === 0) || index === indexEndTime)
                    if (record.position_long[index] !== undefined && record.position_lat[index] !== undefined && rawdata.dirty[index] != true) {
                        //console.log("Setting lat,long in activityCoordinates",record.position_lat[index],record.position_long[index]," index", index);
                        self.masterVM.activityCoordinates[type].push(new google.maps.LatLng(util.semiCirclesToDegrees(record.position_lat[index]), util.semiCirclesToDegrees(record.position_long[index])));
                    }
                    }

            console.info("Total length of polyline array with coordinates is : ", self.masterVM.activityCoordinates[type].length.toString());

        self.masterVM.activityPolyline[type] = new google.maps.Polyline({
            path: self.masterVM.activityCoordinates[type],
            strokeColor: chosenStrokeColor,
            strokeOpacity: chosenStrokeOpacity,
            strokeWeight: chosenStrokeWeight
        });

        self.masterVM.activityPolyline[type].setMap(map);

        return true;
      

    };

    UIController.prototype.convertSpeedConverterModel = function (speedMprSEC) {
       
        //ko.mapping.fromJS(speedMprSEC, {}, this);
        var self = this;
        var minPrKM;
        var minPr100M;
        
        self.value = speedMprSEC;

         self.toMINpr100M = ko.computed(function () {
           
            if (speedMprSEC > 0)
                minPr100M = 1 / (speedMprSEC * 60 / 100); // min/100m
            else
                minPr100M = 0;

            var minutes = Math.floor(minPr100M);
            var seconds = ((minPr100M - minutes) * 60).toFixed(); // implicit rounding

            var result = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, self);

        self.toMINprKM = ko.computed(function () {
           
            if (speedMprSEC > 0)
                minPrKM = 1 / (speedMprSEC * 60 / 1000); // min/km
            else
                minPrKM = 0;

            var minutes = Math.floor(minPrKM);
            var seconds = parseInt(((minPrKM - minutes) * 60).toFixed(),10); // implicit rounding
            if (seconds === 60) {
                seconds = 0;
                minutes += 1;
            }
            var result = (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, self);

        self.toKMprH = ko.computed(function () {
            var kmPrH = (speedMprSEC * 3.6).toFixed(1);
            return kmPrH;
        }, self);
        
        
    };

    UIController.prototype.convertToFullDate = function (UTCmillisec)
        //// Callback on "create" from knockout
    {
        this.value = UTCmillsec;
        this.fullDate = ko.computed(function () {
            return Highcharts.dateFormat('%A %e %B %Y %H:%M:%S', UTCmillisec)
        }, this);
    };
   

    UIController.prototype.convertSecsToHHMMSSModel = function (totalSec) {
        // Callback on "create" from knockout
        //ko.mapping.fromJS(totalSec, {}, this); //Maybe not needed on scalar object

        this.value = totalSec;
        

        this.toHHMMSS = ko.computed(function () {
            // http://stackoverflow.com/questions/1322732/convert-seconds-to-hh-mm-ss-with-javascript

            var hours = parseInt(totalSec / 3600, 10) % 24;
            var minutes = parseInt(totalSec / 60, 10) % 60;
            var seconds = parseInt(totalSec % 60, 10);

            var hourResult;
            if (hours != 0)
                hourResult = (hours < 10 ? "0" + hours : hours) + ":";
            else
                hourResult = "";

            var result = hourResult + (minutes < 10 ? "0" + minutes : minutes) + ":" + (seconds < 10 ? "0" + seconds : seconds);
            return result;
        }, this);
    };

    UIController.prototype.intepretMessageCounters  = function (counter) {
        if (counter.fileIdCounter != 1)
            console.error("File id msg. should be 1, but is ", counter.fileIdCounter);
        if (counter.fileCreatorCounter != 1)
            console.error("File creator msg. should be 1, but is ", counter.fileCreatorCounter);
        if (counter.sessionCounter === 0)
            console.error("Session msg. should be at least 1, but is ",counter.sessionCounter);
        if (counter.lapCounter === 0)
            console.error("Lap msg. should be at least 1, but is ",counter.lapCounter);
        if (counter.activityCounter !== 1)
            console.error("Activity msg. should be 1, but is ", counter.activityCounter);
        if (counter.deviceInfoCounter === 0)
            console.error("Expected more than 0 device_info msg. ", counter.deviceInfoCounter);
        if (counter.recordCounter === 0)
            console.error("No record msg. ", counter.lapCounter);

    };

    UIController.prototype.resetViewModel = function (viewModel,fieldDefProperties) {

        var fitActivity = FIT.ActivityFile();
        //var sessionFieldDef = fitActivity.session();
       
        // Take timestamp first to collapse DOM outline and hopefully make other collapses "hidden"

        if (viewModel.timestamp)
            viewModel.timestamp([]);

        var fieldDefProperty;
        for (var fieldDefNr in fieldDefProperties) {
            fieldDefProperty = fieldDefProperties[fieldDefNr].property;
            if (viewModel[fieldDefProperty] && fieldDefProperty !== "timestamp" ) {
                // console.log("RemoveAll() on ", observableArray);
                viewModel[fieldDefProperty]([]);
            }
        }

       

    };

    UIController.prototype.onFITManagerMsg = function (e) {
   // NB Callback, this reference....
       
        

        var fitActivity = FIT.ActivityFile();

        var eventdata = e.data;

        switch (eventdata.response) {

            case 'rawData':
                //var rawData = JSON.parse(data.rawdata);
               
                var rawData = eventdata.rawdata;

                FITUtil.setDirtyTimestamps(rawData, rawData.record.timestamp);

                // Holds index of previously lookedup timestamps in rawdata.record.timestamp array
                FITUI.timestampIndexCache = [];
                FITUI.intepretMessageCounters(rawData.counter);

                // Value converters that are run on "create"-event/callback in knockout
                var mappingOptions = {
                    //'start_time' : {
                    //    create: function (options) {
                    //        return new FITUI.convertToFullDate(options.data);
                    //    }
                    //},
                    'total_elapsed_time': {
                        create: function (options) {
                            return new FITUI.convertSecsToHHMMSSModel(options.data);
                        }
                    },
                    'total_timer_time': {
                        create: function (options) {
                            return new FITUI.convertSecsToHHMMSSModel(options.data);
                        }
                    },
                    'avg_speed': {
                        create: function (options) {
                            return new FITUI.convertSpeedConverterModel(options.data);
                        }
                    },
                    'max_speed': {
                        create: function (options) {
                            return new FITUI.convertSpeedConverterModel(options.data);
                        }
                    }
                };
                

                //var liId = '#liSessions';
                //var jquerySessionElement = $(liId);
                //var sessionElement = jquerySessionElement[0];
                //console.log(liId + " for data binding", sessionElement);

                if (rawData.session === undefined)
                    rawData.session = FITUtil.restoreSession(rawData); // Maybe do more work on this, but not prioritized

                

                FITUI.masterVM.sessionVM.setRawdata(FITUI, rawData);

                ko.mapping.fromJS(rawData.session, mappingOptions, FITUI.masterVM.sessionVM);

                FITUI.masterVM.sessionVM.selectedSession(0);  // Start with first session, there is no session object but an common index for a timestamp to all arrays 

                   
                //var jqueryLapNode = $('#divLaps');
                //var lapNode = jqueryLapNode[0];
                //console.log("#divLaps for data binding", lapNode);

                //if (FITUI.lapViewModel === undefined && rawData.lap) {
                //    FITUI.lapViewModel = emptyViewModel(fitActivity.lap());
                FITUI.masterVM.lapVM.setRawdata(FITUI, rawData);
                 ko.mapping.fromJS(rawData.lap, mappingOptions, FITUI.masterVM.lapVM);
                //       // jqueryLapNode.show();
                //        ko.applyBindings(FITUI.lapViewModel, lapNode);
                       
                //}
                //else {
                //    FITUI.resetViewModel(FITUI.lapViewModel);
                //    ko.mapping.fromJS(rawData.lap, mappingOptions, FITUI.lapViewModel);
                //}

              

                switch (rawData.file_id.type[0]) {
                    case 4: // Activity file

                        FITUI.showLaps(rawData);

                        // Try to catch errors in session start_time/timestamp
                        var start_time;

                        if (typeof (rawData.session.start_time) === "undefined")
                        {
                       
                            console.warn("Session start time not found");
                            start_time = rawData.lap.start_time[0];

                            if (start_time === undefined) {
                                console.warn("Session start time not found in first lap either, trying record head");
                                start_time === rawData.record.timestamp[0];
                            }

                            console.info("Found start_time for session:", start_time);

                            rawData.session.start_time = [];
                            rawData.session.start_time.push(start_time);
                        } else
                            start_time = rawData.session.start_time[0];

                       

                        var timestamp;
                        if (typeof (rawData.session.timestamp) === "undefined") {
                            console.warn("Session end time not found");
                            timestamp = rawData.lap.timestamp[rawData.session.num_laps - 1];
                            console.info("Timestamp of lap", rawData.session_num_laps, "is :", timestamp);

                            if (timestamp === undefined) {
                                console.warn("Session end not found in timestamp for lap", rawData.session.num_laps);
                                var len = rawData.record.timestamp.length;
                                timestamp === rawData.record.timestamp[len - 1];
                                console.info("Timestamp of last rawdata.record is :", timestamp);
                            }
                            rawData.session.timestamp = [];
                            rawData.session.timestamp.push(timestamp);
                        } else
                            timestamp = rawData.session.timestamp[0];

                      
                      

                        if (FITUI.map) {
                            var sessionMarkerSet = FITUI.showSessionMarkers(FITUI.map, rawData);

                            var sessionAsOverlaySet = FITUI.showSessionsAsOverlay(FITUI.map, rawData);

                            var polylinePlotted = FITUI.showPolyline(rawData, FITUI.map, rawData.record, rawData.session.start_time[0], rawData.session.timestamp[0],
                                {strokeColor : 'red',
                                    strokeOpacity : 1,
                                    strokeWeight : 1},"session");
                        }
                        //if (sessionMarkerSet || sessionAsOverlaySet || polylinePlotted)
                        //   $('#activityMap').show();

                       
                        FITUI.showHRZones(rawData, rawData.session.start_time[0], rawData.session.timestamp[0]);
                         FITUI.showChartsDatetime(rawData, rawData.session.start_time[0], rawData.session.timestamp[0], rawData.session.sport[0]);
                         
                        //FITUI.showChartHrv(rawData);

                        //FITUI.showDataRecordsOnMap(eventdata.datamessages); 
                        break;

                    default:
                        console.warn("Unsupported fit file type, expected 4 (activity file), but got ", rawData.file_id.type[0]);
                        break;

                }

                break;

            case 'header':
                var headerInfo = eventdata.header;
                // Copy to view model
                FITUI.masterVM.headerInfoVM.fileName(headerInfo.fitFile.name);
                FITUI.masterVM.headerInfoVM.fileSize(headerInfo.fitFile.size);
                FITUI.masterVM.headerInfoVM.protocolVersion(headerInfo.protocolVersionMajor + "." + headerInfo.protocolVersionMinor);
              
                FITUI.masterVM.headerInfoVM.profileVersion(headerInfo.profileVersionMajor + "." + headerInfo.profileVersionMinor);
                FITUI.masterVM.headerInfoVM.dataType(headerInfo.dataType);
                FITUI.masterVM.headerInfoVM.headerCRC(headerInfo.headerCRC);
                FITUI.masterVM.headerInfoVM.verifyHeaderCRC(headerInfo.verifyHeaderCRC);
                FITUI.masterVM.headerInfoVM.headerSize(headerInfo.headerSize);
                FITUI.masterVM.headerInfoVM.dataSize(headerInfo.dataSize);
                FITUI.masterVM.headerInfoVM.estimatedFitFileSize(headerInfo.estimatedFitFileSize);


                if (headerInfo.estimatedFitFileSize != headerInfo.fitFile.size)
                    console.warn("Header reports FIT file size " + headerInfo.estimatedFitFileSize.toString() + " bytes, but file system reports: " + headerInfo.fitFile.size.toString() + " bytes.");
                break;

            case 'error':
                var errMsg = eventdata.data;

                if (eventdata.event != undefined) {
                    errMsg += " Event; ";
                    for (var prop in eventdata.event) {
                        if (typeof prop === "string")
                            errMsg += "property " + prop + " : " + eventdata.event.prop;
                    }
                }
                console.error(errMsg);
                break;

            case 'info':
                console.info(eventdata.data);
                break;

            case 'importProgress':
               
            FITUI.masterVM.progressVM.progress(eventdata.data);

                //FITUI.progressFITImport.setAttribute("value", eventdata.data);
            break;

            case 'importFinished':
                //FITUI.masterVM.progressVM.progress(100);
                $("#progressFITimport").hide();
                FITUI.masterVM.progressVM.progress(0);

                break;


            default:
                console.error("Received unrecognized message from worker " + eventdata.response);
                break;
        }



    };

    UIController.prototype.onFITManagerError = function (e) {
        console.error("Error in worker, status " + e.toString());
    };

    UIController.prototype.onFitFileSelected = function (e) {

        if (typeof (e.target.files) === "undefined" || e.target.files.length === 0) {
            console.warn("No file selected for import");
            return;
        }

        var fitActivity = FIT.ActivityFile();

        // console.log(e);
        e.preventDefault();

        //$('#activityMap').hide();

        // Clean up UI state
        FITUI.masterVM.sessionVM.selectedSession(undefined);
        FITUI.masterVM.lapVM.selectedLap(undefined);
        FITUI.resetViewModel(FITUI.masterVM.sessionVM, fitActivity.session());
        FITUI.resetViewModel(FITUI.masterVM.lapVM, fitActivity.lap());
        //// http://api.highcharts.com/highcharts#Chart.destroy()

        if (FITUI.multiChart) {
            FITUI.multiChart.destroy();
            FITUI.multiChart = undefined;
        }

        if (FITUI.HRZonesChart) {
            FITUI.HRZonesChart.destroy();
            FITUI.HRZonesChart = undefined;
        }

        FITUI.selectedFiles = e.target.files;

        var files = FITUI.selectedFiles;

        // Setup mutiple/batch workers
        console.log("Setup of " + files.length + " workers.");
        for (var fileNr = 0; fileNr < files.length; fileNr++) {
            //FITUI["fitFileManager" + fileNr.toString()] = new Worker("Scripts/fitFileManager.js")
            //FITUI["fitFileManager" + fileNr.toString()].addEventListener('message', FITUI.onFITManagerMsg, false);
            //FITUI["fitFileManager" + fileNr.toString()].addEventListener('error', FITUI.onFITManagerError, false);

        }

        // Make sure we terminate previous worker
        if (FITUI.fitFileManager !== undefined) {
            FITUI.fitFileManager.removeEventListener('error', FITUI.onFITManagerError, false);
            FITUI.fitFileManager.removeEventListener('message', FITUI.onFITManagerMsg, false);
            FITUI.fitFileManager.terminate();
        }

        FITUI.fitFileManager = new Worker("Scripts/FITImport.js");
        FITUI.fitFileManager.addEventListener('message', FITUI.onFITManagerMsg, false);
        FITUI.fitFileManager.addEventListener('error', FITUI.onFITManagerError, false);


        // Need to adjust timestamps in the underlying data from Garmin time/System time

        // Start our worker now
        //var msg = { request: 'loadFitFile', "fitfile": files[0], "timeCalibration" : timeCalibration, "globalmessage" : "record", "fields" : "heart_rate altitude cadence speed", skipTimestamps : false };

        //var query = [];

        //query.push(

        //   // { message: "hrv", fields: "time" },
        //   { message: "file_id", fields: "type manufacturer product serial_number time_created number" },
        //   { message: "file_creator", fields: "software_version hardware_version" },
        //   { message: "record", fields: "timestamp position_lat position_long heart_rate altitude speed" },
        //   { message: "session", fields: "timestamp start_time start_position_lat start_position_long total_training_effect num_laps" },
        //   { message: "activity", fields: "timestamp total_timer_time num_sessions type event event_type local_timestamp event_group" },
        //  { message: "hrv", fields: "time" }
        //   );

        // deleteDb();

        var msg = {
            request: 'importFitFile',
            fitfile: files[0],
            store : FITUI.masterVM.settingsVM.storeInIndexedDB()
            //, "query": query
        };


        
        $("#progressFITimport").show();

        FITUI.fitFileManager.postMessage(msg);



    };

    UIController.prototype.showDataRecordsOnMap = function (dataRecords) {

var self = this;
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
    };

    

    function deleteDb() {
        // https://developer.mozilla.org/en-US/docs/IndexedDB/IDBFactory#deleteDatabase
        // Problem : can only delete indexeddb one time in the same tab
        //self.postMessage({ response: "info", data: "deleteDb()" });

        var req;

        try {
            req = indexedDB.deleteDatabase("fit-import");
        } catch (e) {
            console.error(e.message);
        }
        //req.onblocked = function (evt) {
        //    self.postMessage({ respone: "error", data: "Database is blocked - error code" + (evt.target.error ? evt.target.error : evt.target.errorCode) });
        //}


        req.onsuccess = function (evt) {
            console.info("Delete "+evt.currentTarget.readyState);
            
        };

        req.onerror = function (evt) {
            console.error("Error deleting database");
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
        if (myZonesJSONString != null)
            myZones = JSON.parse(myZonesJSONString);
        else {
            console.info("Local storage of " + key + " not found, using default HR Zones");
            myZones = [{ name: 'Zone 1', min: 106, max: 140 },   // No storage found use default
                     { name: 'Zone 2', min: 141, max: 150 },
                     { name: 'Zone 3', min: 151, max: 159 },
                     { name: 'Zone 4', min: 160, max: 170 },
                     { name: 'Zone 5', min: 171, max: 256 }];
        }

        return myZones;
    }

})

// We have created a socalled Immediately-Invoked Function Expression (IIFE)

(); // Run it