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

    
// Constructor function
    function FitFileHeader(bufFitHeader) {

        var dviewFitHeader = new DataView(bufFitHeader);
        // DataView defaults to bigendian MSB --- LSB
        // FIT file header protocol v. 1.3 stored as little endian

        this.headerSize = dviewFitHeader.getUint8(0);


        this.protocolVersion = dviewFitHeader.getUint8(1);
        this.profileVersion = dviewFitHeader.getUint16(2, true);
        this.dataSize = dviewFitHeader.getUint32(4, true);
        this.dataType = ab2str(bufFitHeader.slice(8, 12));

        // Optional header info
 
        if (this.headerSize >= 14) {
            this.headerCRC = dviewFitHeader.getUint16(12, true);
       
        }
        
        
        this.toinnerHTML = function () {
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

      
    }


function fitLoadEnd(e)
{
   
    try {
        var fitHeader = new FitFileHeader(fitReader.result);
        outConsole.innerHTML += fitHeader.toinnerHTML();
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