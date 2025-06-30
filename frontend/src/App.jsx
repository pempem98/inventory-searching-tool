import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import axios from 'axios';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import ContactPopup from './ContactPopup';

// Component để hiển thị các ô chứa link
const LinkCellRenderer = (params) => {
  const isLikelyUrl = (value) => {
    return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
  };

  if (params.value && isLikelyUrl(params.value)) {
    return (
      <a href={params.value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        Open Link
      </a>
    );
  }
  return params.value;
};

const QUICK_FILTER_FIELDS = ['Phân khu', 'Tòa', 'Loại căn hộ', 'Căn', 'Tầng'];
const PRICE_FIELDS = ['Tổng giá bán sau VAT và KPBT', 'TTTĐ', 'TTS', 'Vay'];
const NUMERIC_FIELDS = ['Diện tích thông thủy', ...PRICE_FIELDS];


// Hàm để chuyển đổi chuỗi thành số, xử lý "N/A" và số âm
const parseNumber = (value) => {
    if (typeof value !== 'string') return value;
    if (value.trim().toUpperCase() === 'N/A') return null;
    const number = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (isNaN(number) || number < 0) return null;
    return number;
};

// Hàm so sánh (sắp xếp) tùy chỉnh để luôn đẩy giá trị không hợp lệ xuống cuối
const customNumberComparator = (valueA, valueB) => {
    const aIsFinite = valueA != null && isFinite(valueA);
    const bIsFinite = valueB != null && isFinite(valueB);
    if (aIsFinite && bIsFinite) return valueA - valueB;
    return aIsFinite ? -1 : (bIsFinite ? 1 : 0);
};

// Custom filter matcher để xử lý logic "OR"
const orFilterMatcher = ({ value, filterText }) => {
    if (filterText == null) return true;
    const cellValue = value?.toString().toLowerCase() || '';
    const filterValues = filterText.toLowerCase().split('|').map(v => v.trim()).filter(Boolean);
    if (filterValues.length === 0) return true;
    return filterValues.some(filter => cellValue.includes(filter));
};


function App() {
  const [rowData, setRowData] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [gridApi, setGridApi] = useState(null);
  const isApplyingQuickFilter = useRef(false);

  const [quickFilterValues, setQuickFilterValues] = useState({});
  const [activeFilters, setActiveFilters] = useState({});
  
  const [priceFilterField, setPriceFilterField] = useState(PRICE_FIELDS[0]);
  const [priceRange, setPriceRange] = useState({ min: null, max: null });
  
  const API_URL = '/api/data';

  useEffect(() => {
    axios.get(API_URL)
      .then(response => {
        let data = response.data;
        if (data && data.length > 0) {
            data = data.map(row => {
                const newRow = {...row};
                if (newRow.hasOwnProperty('Diện tích tim tường')) {
                    newRow['Diện tích thông thủy'] = newRow['Diện tích tim tường'];
                    delete newRow['Diện tích tim tường'];
                }
                NUMERIC_FIELDS.forEach(field => {
                    if (newRow.hasOwnProperty(field)) {
                        newRow[field] = parseNumber(newRow[field]);
                    }
                });
                return newRow;
            });
          setRowData(data);
        }
      })
      .catch(error => console.error("Error fetching data: ", error));
  }, []);
  
  // Logic tính toán các nút filter phụ thuộc
  useEffect(() => {
    if (rowData.length === 0) return;
    
    let dataForCascading = [...rowData];
    const newQuickFilterValues = {};

    for (const field of QUICK_FILTER_FIELDS) {
        const uniqueValues = [...new Set(dataForCascading.map(item => item[field]).filter(Boolean))];
        uniqueValues.sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true}));
        newQuickFilterValues[field] = uniqueValues;

        const activeValuesForField = activeFilters[field];
        if (activeValuesForField && activeValuesForField.length > 0) {
            dataForCascading = dataForCascading.filter(item => activeValuesForField.includes(item[field]));
        }
    }

    setQuickFilterValues(newQuickFilterValues);

  }, [rowData, activeFilters]);

  useEffect(() => {
    if (rowData.length === 0) return;
    
    const desiredColumnOrder = [
        'Mã căn', 'Loại căn hộ', 'Diện tích thông thủy', 'Hướng', 'Tổng giá bán sau VAT và KPBT', 'TTTĐ', 'TTS', 'Vay', 'Link PTG', 'Link ảnh chỉ căn'
    ];
    const columnsToHide = ['Phân khu', 'Tòa', 'Tầng', 'Căn', 'Loại quỹ'];

    const existingHeaders = Object.keys(rowData[0]);
    const finalColumnOrder = [...desiredColumnOrder, ...columnsToHide, ...existingHeaders.filter(h => !desiredColumnOrder.includes(h) && !columnsToHide.includes(h))];
    
    const colDefs = finalColumnOrder.map(header => {
        const colDef = { 
            headerName: header, 
            field: header, 
            sortable: true, 
            resizable: true, 
            floatingFilter: true,
            minWidth: 120 // *** THAY ĐỔI: Thêm độ rộng tối thiểu cho tất cả các cột ***
        };

        if (columnsToHide.includes(header)) {
            colDef.hide = true;
        }

        switch (header) {
            case 'Mã căn': colDef.flex = 1; break;
            case 'Tòa': colDef.flex = 1; break;
            case 'Loại căn hộ': colDef.flex = 1; break;
            case 'Phân khu': colDef.flex = 1; break;
            case 'Diện tích thông thủy': colDef.flex = 1.25; break;
            case 'Tổng giá bán sau VAT và KPBT': colDef.flex = 1.5; break;
            case 'Tầng': colDef.flex = 0.75; break;
            case 'Căn': colDef.flex = 0.75; break;
            default: colDef.flex = 1; break;
        }

        if (QUICK_FILTER_FIELDS.includes(header)) {
            colDef.filter = 'agTextColumnFilter';
            colDef.filterParams = { textMatcher: orFilterMatcher };
        } else if (NUMERIC_FIELDS.includes(header)) {
            colDef.filter = 'agNumberColumnFilter';
            colDef.comparator = customNumberComparator;
            colDef.valueFormatter = (params) => {
                if (params.value == null || !isFinite(params.value)) return '';
                if (header === 'Diện tích thông thủy') {
                    return params.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
                return params.value.toLocaleString('de-DE');
            };
        } else if (header === 'Link PTG' || header === 'Link ảnh chỉ căn') {
            colDef.filter = false; colDef.floatingFilter = false; colDef.cellRenderer = LinkCellRenderer;
        } else {
            colDef.filter = 'agTextColumnFilter';
        }
        return colDef;
    });
    setColumnDefs(colDefs);
  }, [rowData]);

  const defaultColDef = useMemo(() => ({ 
      filterParams: { debounceMs: 200 },
      suppressHeaderMenuButton: false, 
    }), []);
  
  const onGridReady = useCallback((params) => {
    setGridApi(params.api);
  }, []);

  useEffect(() => {
    if (gridApi && rowData.length > 0) {
        gridApi.applyColumnState({
            state: [
                { colId: 'Tổng giá bán sau VAT và KPBT', sort: 'asc' },
                { colId: 'Loại quỹ', sort: 'asc' }
            ],
            defaultState: { sort: null },
        });
    }
  }, [gridApi, rowData]);

  const handleQuickFilterClick = (field, value) => {
    setActiveFilters(prev => {
        const current = prev[field] || [];
        const newValues = current.includes(value) 
            ? current.filter(v => v !== value)
            : [...current, value];
        const newFilters = { ...prev, [field]: newValues };
        const fieldIndex = QUICK_FILTER_FIELDS.indexOf(field);
        for (let i = fieldIndex + 1; i < QUICK_FILTER_FIELDS.length; i++) {
            const childField = QUICK_FILTER_FIELDS[i];
            newFilters[childField] = [];
        }
        return newFilters;
    });
  };
  
  const handleClearAllFilters = () => {
    setActiveFilters({});
    setPriceRange({ min: null, max: null });
    setPriceFilterField(PRICE_FIELDS[0]);
    if (gridApi) {
        gridApi.applyColumnState({
            state: [
                { colId: 'Tổng giá bán sau VAT và KPBT', sort: 'asc' },
                { colId: 'Loại quỹ', sort: 'asc' }
            ],
            defaultState: { sort: null },
        });
    }
  };
  
  useEffect(() => {
    if (!gridApi) return;
    isApplyingQuickFilter.current = true;
    const filterModel = {};
    Object.entries(activeFilters).forEach(([field, values]) => {
      if (values && values.length > 0) {
        filterModel[field] = { filterType: 'text', type: 'contains', filter: values.join('|') };
      }
    });
    const min = priceRange.min !== null && priceRange.min !== '' ? Number(priceRange.min) : null;
    const max = priceRange.max !== null && priceRange.max !== '' ? Number(priceRange.max) : null;
    if (min !== null || max !== null) {
      const priceFilterModel = { filterType: 'number' };
      if (min !== null && max !== null) {
          filterModel[priceFilterField] = { ...priceFilterModel, type: 'inRange', filter: min, filterTo: max };
      } else if (min !== null) {
          filterModel[priceFilterField] = { ...priceFilterModel, type: 'greaterThanOrEqual', filter: min };
      } else { 
          filterModel[priceFilterField] = { ...priceFilterModel, type: 'lessThanOrEqual', filter: max };
      }
    }
    gridApi.setFilterModel(filterModel);
    gridApi.applyColumnState({
        state: [ { colId: 'Tổng giá bán sau VAT và KPBT', sort: 'asc' } ],
        defaultState: { sort: null },
    });
  }, [activeFilters, gridApi, priceRange, priceFilterField]);

  const onFilterChanged = useCallback(() => {
    if (isApplyingQuickFilter.current) {
        isApplyingQuickFilter.current = false;
        return;
    }
    if (!gridApi) return;
    const newActiveFilters = {};
    const model = gridApi.getFilterModel();
    QUICK_FILTER_FIELDS.forEach(field => {
        if (model[field] && model[field].filterType === 'text') {
            const filterText = model[field].filter;
            newActiveFilters[field] = filterText ? filterText.split('|').map(v => v.trim()).filter(Boolean) : [];
        }
    });
    setActiveFilters(newActiveFilters);
  }, [gridApi]);

  const rowClassRules = useMemo(() => ({ 'exclusive-fund-row': (params) => params.data['Loại quỹ'] === '1.Độc quyền' }), []);

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <header className="mb-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-gray-800">Quỹ căn hộ Masterise Homes</h1>
        <p className="text-gray-500 mt-2">Lê Thu Hiền | Liên hệ: 098.819.8519</p>
      </header>

      <div className="mb-4 p-4 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Tìm kiếm nhanh</h3>
            <button
                onClick={handleClearAllFilters}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
            >
                Xóa tất cả
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div>
                <label htmlFor="price-field" className="block text-sm font-medium text-gray-700">Lọc theo giá</label>
                <select 
                    id="price-field"
                    value={priceFilterField}
                    onChange={e => setPriceFilterField(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                    {PRICE_FIELDS.map(field => <option key={field} value={field}>{field}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="min-price" className="block text-sm font-medium text-gray-700">Giá thấp nhất</label>
                <input
                    type="number" id="min-price" value={priceRange.min ?? ''}
                    onChange={e => setPriceRange(p => ({ ...p, min: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: 5000000000"
                />
            </div>
            <div>
                <label htmlFor="max-price" className="block text-sm font-medium text-gray-700">Giá cao nhất</label>
                <input
                    type="number" id="max-price" value={priceRange.max ?? ''}
                    onChange={e => setPriceRange(p => ({ ...p, max: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="VD: 10000000000"
                />
            </div>
        </div>
        <hr className="mb-4"/>

        {QUICK_FILTER_FIELDS.map(field => (
          <div key={field} className="mb-3">
            <p className="font-medium text-gray-700">{field}:</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {quickFilterValues[field]?.map(value => {
                const isSelected = activeFilters[field]?.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => handleQuickFilterClick(field, value)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors duration-200 
                      ${isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
                    }
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="ag-theme-alpine shadow-2xl rounded-lg" style={{ height: '75vh', width: '100%' }}>
        {/* *** THAY ĐỔI: Bọc Grid trong một div có overflowX *** */}
        <div style={{ height: '100%', width: '100%', overflowX: 'auto' }}>
            <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination={true}
            paginationPageSize={20}
            animateRows={true}
            onGridReady={onGridReady}
            rowClassRules={rowClassRules}
            enableCellTextSelection={true}
            onFilterChanged={onFilterChanged}
            headerHeight={60} // *** THAY ĐỔI: Thêm chiều cao cho header ***
            />
        </div>
      </div>

      <footer className="text-center mt-8 text-gray-500 text-sm">
        <p>Copyright &copy; {new Date().getFullYear()} Lucas Do. All Rights Reserved.</p>
      </footer>

      <ContactPopup />

    </div>
  );
}

export default App;
