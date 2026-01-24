import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileText, Download, Calendar, DollarSign, User, Globe, Plus, X } from 'lucide-react';
import { loadWeeklyTimesheet, saveInvoiceSettings, loadInvoiceSettings } from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  PDFDownloadLink,
  Font
} from '@react-pdf/renderer';
import { format, parseISO, isWithinInterval, startOfWeek } from 'date-fns';
import { useUserPreferences } from '../contexts/UserPreferencesContext';

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Pure function for currency formatting
const formatCurrency = (amount, currency) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    GBP: '£'
  };
  return `${symbols[currency]}${amount.toFixed(2)}`;
};

// Utility function for calculating day total hours
const calculateDayTotal = (timeIn, timeOut, breakHours) => {
  if (!timeIn || !timeOut) return 0;

  try {
    // Split time strings to get hours and minutes (exactly like TimesheetTable)
    const [inHours, inMinutes] = timeIn.split(':').map(Number);
    const [outHours, outMinutes] = timeOut.split(':').map(Number);

    // Convert to total minutes (exactly like TimesheetTable)
    const inTotalMinutes = (inHours * 60) + inMinutes;
    const outTotalMinutes = (outHours * 60) + outMinutes;

    // Calculate difference
    let totalMinutes = outTotalMinutes - inTotalMinutes;

    // Handle overnight shifts
    if (totalMinutes < 0) {
      totalMinutes = totalMinutes + (24 * 60);
    }

    // Convert to hours and subtract break hours (exactly like TimesheetTable)
    const totalHours = (totalMinutes / 60) - (parseFloat(breakHours) || 0);

    // Don't allow negative hours (exactly like TimesheetTable)
    return Math.max(0, totalHours);
  } catch (error) {
    console.error('Error calculating time:', error);
    return 0;
  }
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  header: {
    marginBottom: 30,
  },
  businessInfo: {
    marginBottom: 20,
  },
  businessName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1f2937',
  },
  businessAddress: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 2,
  },
  clientInfo: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#374151',
  },
  invoiceDetails: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  invoiceDate: {
    fontSize: 10,
    color: '#6b7280',
  },
  table: {
    marginBottom: 20,
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableHeader: {
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    borderBottomStyle: 'solid',
  },
  tableCell: {
    padding: 8,
    fontSize: 10,
  },
  dateCell: {
    width: '15%',
  },
  descriptionCell: {
    width: '50%',
  },
  hoursCell: {
    width: '15%',
    textAlign: 'right',
  },
  amountCell: {
    width: '20%',
    textAlign: 'right',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  totalContainer: {
    width: '50%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 10,
    color: '#6b7280',
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  grandTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    borderTopStyle: 'solid',
    paddingTop: 5,
    marginTop: 5,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
});

const InvoicePDF = ({ invoiceData, settings, entries }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.businessInfo}>
          <Text style={styles.businessName}>{settings.userName || 'Your Business/Legal Name'}</Text>
          {settings.userAddress ? (
          <Text style={styles.businessAddress}>{settings.userAddress}</Text>
          ) : (
            <>
              <Text style={styles.businessAddress}></Text>
            </>
          )}
          <Text style={styles.businessAddress}>{settings.userEmail || 'contact@yourbusiness.com'}</Text>
        </View>

        <View style={styles.clientInfo}>
          <Text style={styles.sectionTitle}>BILL TO:</Text>
          <Text style={styles.businessName}>{settings.clientName}</Text>
          {settings.clientAddress ? (
          <Text style={styles.businessAddress}>{settings.clientAddress}</Text>
          ) : (
            <>
              <Text style={styles.businessAddress}></Text>
            </>
          )}
        </View>

        <View style={styles.invoiceDetails}>
          <View>
            <Text style={styles.invoiceNumber}>INVOICE #{settings.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>Date: {format(new Date(), 'MMM dd, yyyy')}</Text>
          </View>
          <View>
            <Text style={styles.invoiceDate}>Period: {format(parseISO(settings.startDate), 'MMM dd, yyyy')} - {format(parseISO(settings.endDate), 'MMM dd, yyyy')}</Text>
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <View style={[styles.tableCell, styles.dateCell]}>
            <Text style={{ fontWeight: 'bold' }}>Date</Text>
          </View>
          <View style={[styles.tableCell, styles.descriptionCell]}>
            <Text style={{ fontWeight: 'bold' }}>Description</Text>
          </View>
          <View style={[styles.tableCell, styles.hoursCell]}>
            <Text style={{ fontWeight: 'bold' }}>Hours</Text>
          </View>
          <View style={[styles.tableCell, styles.amountCell]}>
            <Text style={{ fontWeight: 'bold' }}>Amount</Text>
          </View>
        </View>

        {entries.map((entry, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={[styles.tableCell, styles.dateCell]}>
              <Text>{entry.date}</Text>
            </View>
            <View style={[styles.tableCell, styles.descriptionCell]}>
              <Text>{entry.description}</Text>
            </View>
            <View style={[styles.tableCell, styles.hoursCell]}>
              <Text>{entry.hours}</Text>
            </View>
            <View style={[styles.tableCell, styles.amountCell]}>
              <Text>{entry.amount}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalSection}>
        <View style={styles.totalContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Hourly Rate</Text>
            <Text style={styles.totalValue}>{settings.hourlyRate} {settings.currency}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Hours Total</Text>
            <Text style={styles.totalValue}>
              {parseFloat(invoiceData.totalHours) < 1
                ? parseFloat(invoiceData.totalHours) * 60
                : invoiceData.totalHours}{' '}
              {parseFloat(invoiceData.totalHours) < 1 ? 'MIN' : 'HRS'}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{invoiceData.subtotal}</Text>
          </View>
          {invoiceData.additionalsList && invoiceData.additionalsList.map((additional, index) => (
            parseFloat(additional.amount.replace(/[^0-9.-]/g, '')) > 0 && (
              <View key={index} style={styles.totalRow}>
                <Text style={styles.totalLabel}>{additional.name}</Text>
                <Text style={styles.totalValue}>{additional.amount}</Text>
              </View>
            )
          ))}
          <View style={styles.grandTotal}>
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{invoiceData.total}</Text>
            </View>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

const InvoicePage = () => {
  const { weekStart: userWeekStart } = useUserPreferences();
  const [timesheetData, setTimesheetData] = useState({});
  const [isAnyFieldFocused, setIsAnyFieldFocused] = useState(false);
  const focusTimeoutRef = useRef(null);
  const [settings, setSettings] = useState(() => {
    // Load saved settings on initial render
    const savedSettings = loadInvoiceSettings();

    // Set default dates to current week based on user preference
    const now = new Date();
    const weekStartsOn = userWeekStart === 'sunday' ? 0 : 1; // 0 = Sunday, 1 = Monday
    const weekStart = startOfWeek(now, { weekStartsOn });
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get to the end of the week

    return {
      ...savedSettings,
      startDate: savedSettings.startDate || format(weekStart, 'yyyy-MM-dd'),
      endDate: savedSettings.endDate || format(weekEnd, 'yyyy-MM-dd'),
      invoiceNumber: savedSettings.invoiceNumber || `INV-${format(weekEnd, 'yyyy-MM-dd')}`,
      additionalsList: savedSettings.additionalsList || [{ name: '', amount: 0 }]
    };
  });

  useEffect(() => {
    const data = loadWeeklyTimesheet();
    setTimesheetData(data);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveInvoiceSettings(settings);
  }, [settings]);

  // Listen for storage events from other tabs
  useEffect(() => {
    const unsubscribe = storageEventSystem.subscribe('kronos_invoice_settings', (event) => {
      if (event.newValue) {
        try {
          const newSettings = JSON.parse(event.newValue);
          setSettings(prevSettings => ({
            ...prevSettings,
            ...newSettings
          }));
        } catch (error) {
          console.error('Error parsing invoice settings from storage event:', error);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
      }
    };
  }, []);


  // Helper functions to handle focus events with delay
  const handleFieldFocus = () => {
    // Clear any existing timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    setIsAnyFieldFocused(true);
  };
  
  const handleFieldBlur = () => {
    // Clear any existing timeout and set a new one
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }
    focusTimeoutRef.current = setTimeout(() => {
      setIsAnyFieldFocused(false);
    }, 150); // 150ms delay to allow for field switching
  };


  const filterEntries = useMemo(() => {
    if (!settings.startDate || !settings.endDate) return [];

    const entries = [];
    const start = parseISO(settings.startDate);
    const end = parseISO(settings.endDate);

    Object.entries(timesheetData).forEach(([dateKey, dayData]) => {
      try {
        const entryDate = parseISO(dateKey);
        if (isWithinInterval(entryDate, { start, end })) {
          // Use the exact same calculation as TimesheetTable's calculateDayTotal
          const dayTotal = calculateDayTotal(
            dayData.timeIn,
            dayData.timeOut,
            dayData.breakHours
          );
          if (dayTotal > 0) {
            entries.push({
              date: format(entryDate, 'MMM dd, yyyy'),
              description: dayData.workDetails || dayData.tasks || 'Time Entry',
              amount: formatCurrency(dayTotal * settings.hourlyRate, settings.currency),
              hours: dayTotal.toFixed(2),
              duration: dayTotal * 3600 // Keep for compatibility
            });
          }
        }
      } catch (error) {
        console.error('Error processing date:', dateKey, error);
      }
    });

    return entries;
  }, [timesheetData, settings.startDate, settings.endDate, settings.hourlyRate, settings.currency]);


  const calculateTotals = useCallback(() => {
    // Calculate exactly like TimesheetTable's calculateGrandTotal
    // Recalculate from raw data instead of using pre-formatted entry.hours
    let totalHours = 0;
    const start = parseISO(settings.startDate);
    const end = parseISO(settings.endDate);

    Object.entries(timesheetData).forEach(([dateKey, dayData]) => {
      try {
        const entryDate = parseISO(dateKey);
        if (isWithinInterval(entryDate, { start, end })) {
          const dayTotal = calculateDayTotal(
            dayData.timeIn,
            dayData.timeOut,
            dayData.breakHours
          );
          if (dayTotal > 0) {
            totalHours += dayTotal; // Add raw dayTotal like TimesheetTable
          }
        }
      } catch (error) {
        console.error('Error processing date:', dateKey, error);
      }
    });

    const subtotal = totalHours * settings.hourlyRate;
    
    // Calculate total additionals from the list
    const totalAdditionals = (settings.additionalsList || [])
      .reduce((sum, additional) => sum + (additional.amount || 0), 0);
    
    const total = subtotal + totalAdditionals;
    
    return {
      totalHours: totalHours.toFixed(2),
      subtotal: formatCurrency(subtotal, settings.currency),
      additionals: formatCurrency(totalAdditionals, settings.currency),
      total: formatCurrency(total, settings.currency),
      additionalsList: (settings.additionalsList || []).map(additional => ({
        name: additional.name || 'Additionals',
        amount: formatCurrency(additional.amount || 0, settings.currency)
      }))
    };
  }, [timesheetData, settings.startDate, settings.endDate, settings.hourlyRate, settings.additionalsList, settings.currency]);

  const generateFileName = () => {
    const businessName = settings.userName || 'Business';
    // Clean the business name for filename (remove special characters, replace spaces with underscores)
    const cleanBusinessName = businessName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    return `${cleanBusinessName}-${settings.invoiceNumber}.pdf`;
  };

  const totals = useMemo(() => calculateTotals(), [calculateTotals]);

  // Debounce settings for PDF generation to prevent lag during typing
  const debouncedSettings = useDebounce(settings, 500); // 500ms delay

  // Memoize filtered entries for PDF to prevent unnecessary recalculations
  const pdfEntries = useMemo(() => {
    return filterEntries;
  }, [filterEntries]);

  // Memoize totals for PDF
  const pdfTotals = useMemo(() => {
    let totalHours = 0;
    const start = parseISO(debouncedSettings.startDate);
    const end = parseISO(debouncedSettings.endDate);

    Object.entries(timesheetData).forEach(([dateKey, dayData]) => {
      try {
        const entryDate = parseISO(dateKey);
        if (isWithinInterval(entryDate, { start, end })) {
          const dayTotal = calculateDayTotal(
            dayData.timeIn,
            dayData.timeOut,
            dayData.breakHours
          );
          if (dayTotal > 0) {
            totalHours += dayTotal;
          }
        }
      } catch (error) {
        console.error('Error processing date:', dateKey, error);
      }
    });

    const subtotal = totalHours * debouncedSettings.hourlyRate;
    
    // Calculate total additionals from the list
    const totalAdditionals = (debouncedSettings.additionalsList || [])
      .reduce((sum, additional) => sum + (additional.amount || 0), 0);
    
    const total = subtotal + totalAdditionals;
    
    return {
      totalHours: totalHours.toFixed(2),
      subtotal: formatCurrency(subtotal, debouncedSettings.currency),
      additionals: formatCurrency(totalAdditionals, debouncedSettings.currency),
      total: formatCurrency(total, debouncedSettings.currency),
      additionalsList: (debouncedSettings.additionalsList || []).map(additional => ({
        name: additional.name || 'Additionals',
        amount: formatCurrency(additional.amount || 0, debouncedSettings.currency)
      }))
    };
  }, [timesheetData, debouncedSettings.startDate, debouncedSettings.endDate, debouncedSettings.hourlyRate, debouncedSettings.additionalsList, debouncedSettings.currency]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Generator</h1>
        <p className="text-gray-600">Convert your timesheet data into professional PDF invoices</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings and Income Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Settings Panel */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Invoice Settings
            </h2>

            {/* User/Business Information Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Your Business Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business/Legal Name
                  </label>
                  <input
                    type="text"
                    value={settings.userName}
                    onChange={(e) => setSettings(prev => ({ ...prev, userName: e.target.value }))}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your Business or Legal Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Address
                  </label>
                  <textarea
                    value={settings.userAddress}
                    onChange={(e) => setSettings(prev => ({ ...prev, userAddress: e.target.value }))}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                    placeholder="123 Business Street, City, State 12345"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.userEmail}
                    onChange={(e) => setSettings(prev => ({ ...prev, userEmail: e.target.value }))}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="contact@yourbusiness.com"
                  />
                </div>
              </div>
            </div>

            {/* Client Information Section */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Client Information
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={settings.clientName}
                  onChange={(e) => setSettings(prev => ({ ...prev, clientName: e.target.value }))}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter client name"
                />
              </div>

              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Address
                </label>
                <textarea
                  value={settings.clientAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, clientAddress: e.target.value }))}
                  onFocus={handleFieldFocus}
                  onBlur={handleFieldBlur}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter client address"
                />
              </div>
            </div>

            {/* Invoice Details Section */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Invoice Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={settings.invoiceNumber}
                    onChange={(e) => setSettings(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    onFocus={handleFieldFocus}
                    onBlur={handleFieldBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="INV-001"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={settings.startDate}
                      onChange={(e) => setSettings(prev => ({ ...prev, startDate: e.target.value }))}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={settings.endDate}
                      onChange={(e) => setSettings(prev => ({ ...prev, endDate: e.target.value }))}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Hourly Rate
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={settings.hourlyRate}
                        onChange={(e) => setSettings(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                        onFocus={handleFieldFocus}
                        onBlur={handleFieldBlur}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={settings.currency}
                      onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                      onFocus={handleFieldFocus}
                      onBlur={handleFieldBlur}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {settings.additionalsList && settings.additionalsList.map((additional, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div>
                        {index === 0 && (
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Additionals Amount
                          </label>
                        )}
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="number"
                            value={additional.amount || 0}
                            onChange={(e) => {
                              const newList = [...(settings.additionalsList || [])];
                              newList[index] = { ...newList[index], amount: parseFloat(e.target.value) || 0 };
                              setSettings(prev => ({ ...prev, additionalsList: newList }));
                            }}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {index === 0 && (
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Additionals Name
                            </label>
                          )}
                          <input
                            type="text"
                            value={additional.name || ''}
                            onChange={(e) => {
                              const newList = [...(settings.additionalsList || [])];
                              newList[index] = { ...newList[index], name: e.target.value };
                              setSettings(prev => ({ ...prev, additionalsList: newList }));
                            }}
                            onFocus={handleFieldFocus}
                            onBlur={handleFieldBlur}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g. Bonus, Services, Task"
                            maxLength={30}
                          />
                        </div>
                        {settings.additionalsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newList = settings.additionalsList.filter((_, i) => i !== index);
                              setSettings(prev => ({ ...prev, additionalsList: newList }));
                            }}
                            className={`${index === 0 ? 'mt-6' : ''} px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors`}
                            title="Remove additionals"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      const newList = [...(settings.additionalsList || []), { name: '', amount: 0 }];
                      setSettings(prev => ({ ...prev, additionalsList: newList }));
                    }}
                    className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 hover:text-green-600 hover:border-green-400 hover:bg-green-50 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Income Preview Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2" />
              Income Summary
            </h3>

            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Total Hours</span>
                  <span className="text-lg font-bold text-blue-900">{totals.totalHours}</span>
                </div>
              </div>

              {(settings.additionalsList && settings.additionalsList.some(a => a.amount > 0)) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Subtotal</span>
                    <span className="text-lg font-bold text-gray-900">{totals.subtotal}</span>
                  </div>
                </div>
              )}

              {totals.additionalsList && totals.additionalsList.map((additional, index) => (
                parseFloat(additional.amount.replace(/[^0-9.-]/g, '')) > 0 && (
                  <div key={index} className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">{additional.name}</span>
                      <span className="text-lg font-bold text-green-900">{additional.amount}</span>
                    </div>
                  </div>
                )
              ))}

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Total Amount</span>
                  <span className="text-lg font-bold text-green-900">{totals.total}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Based on {settings.currency} {settings.hourlyRate}/hour
                {settings.additionalsList && settings.additionalsList.some(a => a.amount > 0) && 
                  ` + ${settings.currency} ${settings.additionalsList.reduce((sum, a) => sum + (a.amount || 0), 0).toFixed(2)} additionals`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Invoice Preview
              </h2>

              {filterEntries.length > 0 && settings.clientName && !isAnyFieldFocused && (
                <PDFDownloadLink
                  document={
                    <InvoicePDF
                      invoiceData={pdfTotals}
                      settings={debouncedSettings}
                      entries={pdfEntries}
                    />
                  }
                  fileName={generateFileName()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {({ loading }) => (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      {loading ? 'Generating...' : 'Download PDF'}
                    </>
                  )}
                </PDFDownloadLink>
              )}

              {isAnyFieldFocused && (
                <div className="inline-flex items-center px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed" title="Deselect any input field to continue">
                  <Download className="w-4 h-4 mr-2" />
                  Finish editing...
                </div>
              )}
            </div>

            {filterEntries.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No time entries found for the selected date range.</p>
                <p className="text-sm text-gray-400 mt-2">Try adjusting the date range or check your timesheet data.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Hours</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterEntries.map((entry, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{entry.date}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{entry.description}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">{entry.hours}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          {formatCurrency(parseFloat(entry.hours) * settings.hourlyRate, settings.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(settings.additionalsList && settings.additionalsList.some(a => a.amount > 0)) && (
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="py-3 px-4 text-sm font-medium text-gray-700">
                          Subtotal ({totals.totalHours} hours)
                        </td>
                        <td colSpan={2} className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
                          {totals.subtotal}
                        </td>
                      </tr>
                    )}
                    {totals.additionalsList && totals.additionalsList.map((additional, index) => (
                      parseFloat(additional.amount.replace(/[^0-9.-]/g, '')) > 0 && (
                        <tr key={index} className="bg-green-50">
                          <td colSpan={2} className="py-3 px-4 text-sm font-medium text-green-700">
                            {additional.name}
                          </td>
                          <td colSpan={2} className="py-3 px-4 text-sm font-bold text-green-900 text-right">
                            {additional.amount}
                          </td>
                        </tr>
                      )
                    ))}
                    <tr className="bg-green-100">
                      <td colSpan={2} className="py-3 px-4 text-sm font-bold text-green-900">
                        Total Amount
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-sm font-bold text-green-900 text-right">
                        {totals.total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePage;
