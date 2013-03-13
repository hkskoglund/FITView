FITView
=======

A single page web app for reading .FIT files (from GARMIN) and to visualize data like heart rate, heart rate zones and heart rate variability.

Technical
---------
  - pure javascript import using web worker and File API
  - UI based on knockoutjs data-binding and mapping

Supports
--------
 
  - reads/imports multiple .FIT activity files
  - track viewing
  - multisport files (swimming not tested much...may lack functionality)
  - lap triggers (i.e auto lap at distance)
  - events (i.e start, stop)
  - device info (device/sensors, serial numbers, firmware version)
  - export HRV data as CSV
  - TE history (if importing multiple files)
  - weekly calories (if importing multiple files)
  - some support for allowing non-conformat FIT (i.e missing session info)

External libraries
------------------

  - highcharts
  - knockoutjs
  - google Maps API
  - momentjs
  - modernizr
  - jquery

----------

![Alt text](/FITView/Images/Screenshot/FITView.png "FITView")
