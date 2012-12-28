// Setup DOM event handling

// Capturing = false -> bubbling event
var inpFITFile = document.getElementById('inpFITFile');
    inpFITFile.addEventListener('change', onFitFileSelected, false);

var btnParse = document.getElementById('btnParse')
    btnParse.addEventListener('click', onbtnParseClick, false);

    var fitReader = new FileReader();
    var dviewFitFile;

    var outConsole = document.getElementById('outConsole');

    var bufFitFile; // ArrayBuffer -> contains FIT file

    var fitReader;

    var MAXFITHEADERLENGTH = 14; // FIT Protocol rev 1.3 p. 13

// e = event object

function onFitFileSelected(e) {
   // console.log(e);
    e.preventDefault();


    fitFile = e.target.files[0];
    outConsole.innerHTML = '<p>Size: ' + fitFile.size.toString() + ' bytes, last modified: ' + fitFile.lastModifiedDate.toLocaleDateString() + '</p>';

    // To do: check file size

    var btnParse = document.getElementById('btnParse');
    btnParse.style.visibility = 'visible';

    
}

// Adapted From http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint8Array(buf));
    }

    function parseRecordHeader(recHeader) {


    }

// Constructor function
    function FitFileHeader(headerSize, protocolVersion, profileVersion, dataSize, dataType, headerCRC) {
        this.headerSize = headerSize;
        this.protocolVersion = protocolVersion;
        this.profileVersion = profileVersion;
        this.dataSize = dataSize;
        this.dataType = dataType;
        this.toinnerHTML = function () {
            var headerHtml = '<p>Header size : ' + headerSize.toString() + ' bytes ' +
        'Protocol version : ' + protocolVersion.toString() +
        ' Profile version : ' + profileVersion.toString() +
        ' Data size: ' + dataSize.toString() + ' bytes' +
        ' Data type: ' + dataType;
            if (headerCRC != undefined) {
                headerHtml += 
        ' CRC: ' + parseInt(headerCRC, 10).toString(16);
        }
    }


function parseFitHeader(bufFitHeader) {
    var dviewFitHeader = new DataView(bufFitHeader);
    // DataView defaults to bigendian MSB --- LSB
    // FIT file header protocol v. 1.3 stored as little endian
    var fitHeader = new FitFileHeader(dviewFitHeader.getUint8(0), dviewFitHeader.getUint8(1),
                                    dviewFitHeader.getUint16(2, true), dviewFitHeader.getUint32(4, true),
                                    ab2str(bufFitHeader.slice(8, 12)));
    
    // Optional header info
 
    if (fitHeader.headerSize >= 14) {
        fitHeader.headerCRC = dviewFitHeader.getUint16(12, true);
       
    }

    // Skip additional optional header info...

    outConsole.innerHTML += fitHeader.toinnerHTML;

    return fitHeader.headerSize;

}


function fitLoadEnd(e)
{
    bufFitFile = fitReader.result;
    // To do: check for length >= header+crc?

    var headerSize;
    
    try {
        headerSize = parseFitHeader(bufFitFile);
    } catch (e) {
        console.error('Trouble with FIT file header parsing, message:', e.message);
    }

    
    
}

function onbtnParseClick(e) {
    fitReader.addEventListener('loadend', fitLoadEnd, false);
    try {
        fitReader.readAsArrayBuffer(fitFile);
       
    } catch (e) {
        console.error('Could not initialize fit file reader with bytes, message:',e.message);
    }
    
}