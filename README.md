FITView
=======

A single page web app for reading .FIT files (from GARMIN) and to visualize data like heart rate, heart rate zones and heart rate variability.

Support for:
  - pure javascript import using web worker
  - UI based on knockoutjs data-binding and mapping
  - reads/imports multiple .FIT activity files
  - track viewing
  - multisport files (swimming not tested much...may lack functionality)
  - lap triggers (i.e auto lap at distance)
  - events (i.e start, stop)
  - device info (device, firmware version)
  - export HRV data as CSV
  - TE history (if importing multiple files)
  - weekly calories (if importing multiple files)
  - some support for allowing non-conformat FIT (i.e missing session info)

External libraries used:

  - highcharts
  - knockoutjs

![Alt text](/FITView/Images/Screenshot/FITView.png "FITView")
