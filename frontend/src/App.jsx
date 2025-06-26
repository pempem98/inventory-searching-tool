import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

function App() {
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  
  const API_URL = '/api/data';

  useEffect(() => {
    axios.get(API_URL)
      .then(response => {
        const data = response.data;
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]);
          
          const colDefs = headers.map(header => ({
            headerName: header,
            field: header,
            sortable: true,
            filter: 'agTextColumnFilter',
            floatingFilter: true,
            resizable: true,
          }));

          setColumnDefs(colDefs);
          setRowData(data);
        }
      })
      .catch(error => console.error("Error fetching data: ", error));
  }, []);

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 150,
  }), []);

  return (
    <div className="p-4 md:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-gray-800">Bảng Dữ Liệu Google Sheet</h1>
        <p className="text-gray-500 mt-2">Dữ liệu được cache để tăng tốc độ</p>
      </header>
      <div className="ag-theme-alpine shadow-2xl rounded-lg overflow-hidden" style={{ height: '75vh', width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          pagination={true}
          paginationPageSize={20}
          animateRows={true}
        />
      </div>
    </div>
  );
}

export default App;
