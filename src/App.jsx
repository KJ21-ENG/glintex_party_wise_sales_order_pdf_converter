
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, FileWarning, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from './components/ui/card';
import { parseExcel } from './utils/excelParser';
import { generatePartyWisePDF } from './utils/pdfGenerator';

function App() {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setParsedData(null);
    setIsProcessing(true);

    try {
      const buffer = await uploadedFile.arrayBuffer();
      const data = await parseExcel(buffer);
      setParsedData(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to parse the Excel file.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleGeneratePDF = () => {
    console.log("Generate PDF clicked");
    if (parsedData) {
      console.log("Parsed data available, calling generator", parsedData);
      try {
        generatePartyWisePDF(parsedData);
        console.log("PDF generation function called");
      } catch (error) {
        console.error("Error generating PDF:", error);
      }
    } else {
      console.log("No parsed data available");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900 selection:bg-blue-100">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center space-y-4">
          <div className="flex flex-col items-center justify-center space-y-4 logo-shimmer p-4 rounded-xl">
            {/* Logo Icon (Square) */}
            <img src="/icon.png" alt="GLINTEX Icon" className="h-20 w-auto object-contain drop-shadow-md" />

            {/* Wordmark (Text) - scaled up */}
            <img src="/wordmark.png" alt="GLINTEX" className="h-12 w-auto object-contain" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Party-wise Sales Order PDF Converter</h1>
            <p className="text-slate-500">Upload a Tally-style Sales Orders (Due Only) Excel file to generate a professional PDF.</p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-10 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center space-y-4
                ${isDragActive ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
                ${file ? 'bg-green-50/30 border-green-200' : ''}
              `}
            >
              <input {...getInputProps()} />

              {isProcessing ? (
                <div className="space-y-3">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-600">Processing file...</p>
                </div>
              ) : error ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <FileWarning className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Error parsing file</p>
                    <p className="text-xs text-red-500 mt-1">{error}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}>
                    Try Again
                  </Button>
                </div>
              ) : file && parsedData ? (
                <div className="space-y-3">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">File processed successfully</p>
                    <p className="text-xs text-slate-500 mt-1">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">Found {parsedData.data.length} parties</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">
                      {isDragActive ? "Drop the file here" : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Supported formats: .xlsx, .xls
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-slate-100 pt-6">
            <Button variant="ghost" onClick={() => { setFile(null); setParsedData(null); setError(null); }} disabled={!file && !error}>
              Clear
            </Button>
            <Button onClick={handleGeneratePDF} disabled={!parsedData} className="bg-slate-900 hover:bg-slate-800 text-white">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

export default App;
