// Setup DOM event handling

// Capturing = false -> bubbling event
    var inpFITFile = document.getElementById('inpFITFile');
    inpFITFile.addEventListener('change', onFitFileSelected, false);

    var btnParse = document.getElementById('btnParse')
    btnParse.addEventListener('click', onbtnParseClick, false);

   

    var outConsole = document.getElementById('outConsole');

    var selectedFiles; // All File thats selected

// User interface events

    function onbtnParseClick(e) {
        var fitManager = new FitFileManager(selectedFiles[0]);
        fitManager.loadFile();
    }


function onFitFileSelected(e) {
   // console.log(e);
    e.preventDefault();

    selectedFiles = e.target.files;
   
    // To do: check file size

    var btnParse = document.getElementById('btnParse');
    btnParse.style.visibility = 'visible';

    
}

// Adapted From http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

// Ported from C to javascript from FIT SDK 5.10 fit_crc.c
// Accessed: 28 december 2012

 function fitCRC_Get16(crc, byte)
    {
   var crc_table =
    [
      0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
      0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400
    ];

   var tmp;

    // compute checksum of lower four bits of byte
    tmp = crc_table[crc & 0xF];
    crc  = (crc >> 4) & 0x0FFF;
    crc  = crc ^ tmp ^ crc_table[byte & 0xF];

    // now compute checksum of upper four bits of byte
    tmp = crc_table[crc & 0xF];
    crc  = (crc >> 4) & 0x0FFF;
    crc  = crc ^ tmp ^ crc_table[(byte >> 4) & 0xF];

    return crc;
    }

 function fitCRC(payloadview,start,end) {
     var crc = 0;
     
     for (var i=start; i < end; i++)
     {
       crc =  fitCRC_Get16(crc, payloadview.getUint8(i));
     }
     
 return crc;

 }

 function FitFileManager(fitFile) {

     var self = this;

     this.fitFile = fitFile;
   
     outConsole.innerHTML = '<p>Size: ' + this.fitFile.size.toString() + ' bytes, last modified: ' + this.fitFile.lastModifiedDate.toLocaleDateString() + '</p>';

     // Callback for loadend event on FileReader
     // e = ProgressEvent
     // this = FileReader

     this.fitLoadEnd = function (e) {
         try {
             // self contains a reference to fitFileManager
             self.readHeader(self.fitReader.result, self.fitFile.size);
             outConsole.innerHTML += self.toinnerHTML();
         } catch (e) {
             console.error('Trouble with FIT file header parsing, message:', e.message);
         }

     }
 }



 FitFileManager.prototype.loadFile = function () {
     this.fitReader = new FileReader();
     this.fitReader.addEventListener('loadend', this.fitLoadEnd, false);

     try {
         this.fitReader.readAsArrayBuffer(this.fitFile);

     } catch (e) {
         console.error('Could not initialize fit file reader with bytes, message:', e.message);
     }
 }

 FitFileManager.prototype.readHeader = function (bufFitHeader, fitFileSystemSize) {

     var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

     var dviewFitHeader = new DataView(bufFitHeader);
     // DataView defaults to bigendian MSB --- LSB
     // FIT file header protocol v. 1.3 stored as little endian

     this.headerSize = dviewFitHeader.getUint8(0);


     this.protocolVersion = dviewFitHeader.getUint8(1);
     this.profileVersion = dviewFitHeader.getUint16(2, true);
     this.dataSize = dviewFitHeader.getUint32(4, true);

     var estimatedFitFileSize = this.headerSize + this.dataSize+2;  // 2 for last CRC
     if (estimatedFitFileSize != fitFileSystemSize)
         console.warn("Header reports FIT file size " + estimatedFitFileSize.toString() + " bytes, but file system reports: " + fitFileSystemSize.toString()+" bytes.");

     this.dataType = ab2str(bufFitHeader.slice(8, 12));

     // Optional header info
 
     if (this.headerSize >= MAXFITHEADERLENGTH) {
         this.headerCRC = dviewFitHeader.getUint16(12, true);
         if (this.headerCRC === 0)
             console.info("Header CRC was not computed");
       
     }
 }

 FitFileManager.prototype.toinnerHTML = function () {
     var headerHtml = '<p>Header size : ' + this.headerSize.toString() + ' bytes ' +
 'Protocol version : ' + this.protocolVersion.toString() +
 ' Profile version : ' + this.profileVersion.toString() +
 ' Data size: ' + this.dataSize.toString() + ' bytes' +
 ' Data type: ' + this.dataType;
     if (this.headerCRC != undefined) {
         headerHtml += ' CRC: ' + parseInt(this.headerCRC, 10).toString(16);
     }

     return headerHtml;
 }
 



