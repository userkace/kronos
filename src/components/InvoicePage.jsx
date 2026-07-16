import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FileText, Download, Calendar, DollarSign, User, Globe, Plus, X, Pencil } from 'lucide-react';
import { loadWeeklyTimesheet, saveInvoiceSettings, loadInvoiceSettings } from '../utils/storage';
import storageEventSystem from '../utils/storageEvents';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  pdf,
  Font
} from '@react-pdf/renderer';
import { format, parseISO, isWithinInterval, startOfWeek } from 'date-fns';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useToast } from '../contexts/ToastContext';

// Supported invoice currencies. Drives both the settings dropdown and formatting.
const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'PHP', symbol: '₱' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CNY', symbol: 'CN¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'KRW', symbol: '₩' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CAD', symbol: 'C$' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'HKD', symbol: 'HK$' },
  { code: 'NZD', symbol: 'NZ$' },
  { code: 'CHF', symbol: 'CHF ' },
];

// Click-to-edit field for the business/client info sections: renders the value
// as plain text (with a pencil affordance on hover) and swaps in the real
// input on click, until it loses focus. Display state mirrors the input's
// padding + border so nothing shifts when toggling.
const EditableField = ({ label, value, placeholder, onChange, onFocus, onBlur, multiline = false, rows = 2, type = 'text' }) => {
  const [editing, setEditing] = useState(false);
  const fieldRef = useRef(null);

  useEffect(() => {
    if (editing && fieldRef.current) {
      fieldRef.current.focus();
      const len = fieldRef.current.value.length;
      fieldRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleBlur = (e) => {
    setEditing(false);
    if (onBlur) onBlur(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
      e.preventDefault();
      e.target.blur();
    }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {editing ? (
        multiline ? (
          <textarea
            ref={fieldRef}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder={placeholder}
            className={inputClass}
          />
        ) : (
          <input
            ref={fieldRef}
            type={type}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={inputClass}
          />
        )
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`group flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors duration-150 hover:border-gray-200 hover:bg-gray-50 ${
            value ? 'border-transparent' : 'border-dashed border-gray-200'
          }`}
        >
          <span className={`min-w-0 whitespace-pre-line wrap-break-word ${value ? 'text-gray-900' : 'text-gray-400'}`}>
            {value || placeholder}
          </span>
          <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
        </button>
      )}
    </div>
  );
};

// Pure function for currency formatting
const formatCurrency = (amount, currency) => {
  const symbol = CURRENCIES.find(c => c.code === currency)?.symbol || `${currency} `;
  // Use Math.round to ensure proper rounding before toFixed to avoid floating-point precision issues
  const roundedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `${symbol}${roundedAmount.toFixed(2)}`;
};

// Utility function for calculating day total hours. Mirrors TimesheetTable's
// calculation including HH:mm vs HH:mm:ss tolerance — seconds default to 0
// when absent so legacy entries keep working.
const calculateDayTotal = (timeIn, timeOut, breakHours) => {
  if (!timeIn || !timeOut) return 0;

  try {
    const [inH = 0, inM = 0, inS = 0] = timeIn.split(':').map(Number);
    const [outH = 0, outM = 0, outS = 0] = timeOut.split(':').map(Number);

    const inSeconds = (inH * 3600) + (inM * 60) + inS;
    const outSeconds = (outH * 3600) + (outM * 60) + outS;

    let totalSeconds = outSeconds - inSeconds;
    if (totalSeconds < 0) totalSeconds += 24 * 3600;

    const totalHours = (totalSeconds / 3600) - (parseFloat(breakHours) || 0);
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
            <Text style={styles.invoiceDate}>Date: {format(parseISO(settings.endDate), 'yyyy-MM-dd')}</Text>
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
  const { warning } = useToast();
  const [timesheetData, setTimesheetData] = useState({});
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
      invoiceNumber: savedSettings.invoiceNumber || `INV-${format(parseISO(savedSettings.endDate || format(weekEnd, 'yyyy-MM-dd')), 'yyyy-MM-dd')}`,
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

  // When the user enters an out-of-order range, clamp the field they JUST
  // edited rather than silently mutating the other one. Previously this
  // function moved start backward when end was edited (or end forward when
  // start was edited), which surprised users by changing a field they hadn't
  // touched. Clamping the edited field keeps the change local to the user's
  // intent — the other field's value is preserved.
  const validateAndClampDates = (newStartDate, newEndDate, changedField) => {
    if (!newStartDate || !newEndDate) {
      return { startDate: newStartDate, endDate: newEndDate };
    }

    const start = parseISO(newStartDate);
    const end = parseISO(newEndDate);

    if (changedField === 'start' && start > end) {
      // User pushed start past end — clamp start down to end.
      warning('Start date adjusted to match end date');
      return { startDate: newEndDate, endDate: newEndDate };
    }
    if (changedField === 'end' && end < start) {
      // User pulled end before start — clamp end up to start.
      warning('End date adjusted to match start date');
      return { startDate: newStartDate, endDate: newStartDate };
    }

    return { startDate: newStartDate, endDate: newEndDate };
  };

  // Auto-update invoice number when end date changes
  useEffect(() => {
    if (settings.endDate) {
      const newInvoiceNumber = `INV-${format(parseISO(settings.endDate), 'yyyy-MM-dd')}`;

      // Only update if the invoice number follows the default pattern AND is different
      if (settings.invoiceNumber.startsWith('INV-') && settings.invoiceNumber !== newInvoiceNumber) {
        setSettings(prev => ({ ...prev, invoiceNumber: newInvoiceNumber }));
      }
    }
  }, [settings.endDate, settings.invoiceNumber]);

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

    const totalHoursRounded = Math.round((totalHours + Number.EPSILON) * 100) / 100;
    const subtotal = totalHoursRounded * settings.hourlyRate;
    
    // Calculate total additionals from the list
    const totalAdditionals = (settings.additionalsList || [])
      .reduce((sum, additional) => sum + (additional.amount || 0), 0);
    
    const total = subtotal + totalAdditionals;
    
    return {
      totalHours: totalHoursRounded.toFixed(2),
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

  // Generate the PDF on demand (button click) instead of continuously in the
  // background. Pre-generating on every settings/focus change made the whole
  // page jank — e.g. a visible delay opening the currency dropdown — and
  // required freezing the download link while any field was focused.
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const blob = await pdf(
        <InvoicePDF invoiceData={totals} settings={settings} entries={filterEntries} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      warning('Could not generate the PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Billing</p>
        <h1 className="mt-1.5 font-display text-lg font-semibold text-gray-900">Invoice Generator</h1>
        <p className="mt-1.5 text-sm text-gray-500">Convert your timesheet data into professional PDF invoices.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings and Income Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Settings Panel */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <User className="w-[18px] h-[18px]" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">Invoice Settings</h2>
            </div>

            {/* User/Business Information Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" />
                Your Business Information
              </h3>
              <div className="space-y-3">
                <EditableField
                  label="Business/Legal Name"
                  value={settings.userName}
                  onChange={(e) => setSettings(prev => ({ ...prev, userName: e.target.value }))}
                  placeholder="Your Business or Legal Name"
                />

                <EditableField
                  label="Business Address"
                  value={settings.userAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, userAddress: e.target.value }))}
                  multiline
                  rows={2}
                  placeholder="123 Business Street, City, State 12345"
                />

                <EditableField
                  label="Email"
                  type="email"
                  value={settings.userEmail}
                  onChange={(e) => setSettings(prev => ({ ...prev, userEmail: e.target.value }))}
                  placeholder="contact@yourbusiness.com"
                />
              </div>
            </div>

            {/* Client Information Section */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                Client Information
              </h3>
              <div className="space-y-3">
                <EditableField
                  label="Client Name"
                  value={settings.clientName}
                  onChange={(e) => setSettings(prev => ({ ...prev, clientName: e.target.value }))}
                  placeholder="Enter client name"
                />

                <EditableField
                  label="Client Address"
                  value={settings.clientAddress}
                  onChange={(e) => setSettings(prev => ({ ...prev, clientAddress: e.target.value }))}
                  multiline
                  rows={3}
                  placeholder="Enter client address"
                />
              </div>
            </div>

            {/* Invoice Details Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                Invoice Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    value={settings.invoiceNumber}
                    onChange={(e) => setSettings(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="INV-001"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={settings.startDate}
                      onChange={(e) => {
                        const newStartDate = e.target.value;
                        const { startDate, endDate } = validateAndClampDates(newStartDate, settings.endDate, 'start');
                        setSettings(prev => ({ ...prev, startDate, endDate }));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={settings.endDate}
                      onChange={(e) => {
                        const newEndDate = e.target.value;
                        const { startDate, endDate } = validateAndClampDates(settings.startDate, newEndDate, 'end');
                        setSettings(prev => ({ ...prev, startDate, endDate }));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Hourly Rate
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={settings.hourlyRate}
                        onChange={(e) => setSettings(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Currency
                    </label>
                    <select
                      value={settings.currency}
                      onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
                    >
                      {CURRENCIES.map(({ code }) => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  {settings.additionalsList && settings.additionalsList.map((additional, index) => (
                    <div key={index} className="grid grid-cols-2 gap-4">
                      <div>
                        {index === 0 && (
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {index === 0 && (
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 shadow-xs focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
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
                            className={`${index === 0 ? 'mt-6' : ''} px-3 py-2 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors duration-150`}
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
                    className="w-full py-2.5 border-2 border-dashed border-gray-200 text-gray-400 hover:text-green-600 hover:border-green-400 hover:bg-green-50 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Income Preview Section */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-green-50 text-green-600">
                <DollarSign className="w-[18px] h-[18px]" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 tracking-tight">Income Summary</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Total Hours</span>
                  <span className="text-lg font-bold text-blue-900 tabular-nums">{totals.totalHours}</span>
                </div>
              </div>

              {(settings.additionalsList && settings.additionalsList.some(a => a.amount > 0)) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Subtotal</span>
                    <span className="text-lg font-bold text-gray-900 tabular-nums">{totals.subtotal}</span>
                  </div>
                </div>
              )}

              {totals.additionalsList && totals.additionalsList.map((additional, index) => (
                parseFloat(additional.amount.replace(/[^0-9.-]/g, '')) > 0 && (
                  <div key={index} className="bg-green-50 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-green-900">{additional.name}</span>
                      <span className="text-lg font-bold text-green-900 tabular-nums">{additional.amount}</span>
                    </div>
                  </div>
                )
              ))}

              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Total Amount</span>
                  <span className="text-lg font-bold text-green-900 tabular-nums">{totals.total}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center tabular-nums">
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
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FileText className="w-[18px] h-[18px]" />
                </div>
                <h2 className="text-base font-semibold text-gray-900 tracking-tight">Invoice Preview</h2>
              </div>

              {filterEntries.length > 0 && settings.clientName && (
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-600/25 transition-colors duration-150 disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {generatingPdf ? 'Generating...' : 'Download PDF'}
                </button>
              )}
            </div>

            {filterEntries.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No time entries found for the selected date range.</p>
                <p className="text-sm text-gray-400 mt-2">Try adjusting the date range or check your timesheet data.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Hours</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filterEntries.map((entry, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50/70 transition-colors duration-150">
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{entry.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">{entry.hours}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right tabular-nums">
                          {formatCurrency(parseFloat(entry.hours) * settings.hourlyRate, settings.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {(settings.additionalsList && settings.additionalsList.some(a => a.amount > 0)) && (
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-3 text-sm font-medium text-gray-700">
                          Subtotal ({totals.totalHours} hours)
                        </td>
                        <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-900 text-right tabular-nums">
                          {totals.subtotal}
                        </td>
                      </tr>
                    )}
                    {totals.additionalsList && totals.additionalsList.map((additional, index) => (
                      parseFloat(additional.amount.replace(/[^0-9.-]/g, '')) > 0 && (
                        <tr key={index} className="bg-green-50">
                          <td colSpan={2} className="px-4 py-3 text-sm font-medium text-green-700">
                            {additional.name}
                          </td>
                          <td colSpan={2} className="px-4 py-3 text-sm font-bold text-green-900 text-right tabular-nums">
                            {additional.amount}
                          </td>
                        </tr>
                      )
                    ))}
                    <tr className="bg-green-100">
                      <td colSpan={2} className="px-4 py-3 text-sm font-bold text-green-900">
                        Total Amount
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-sm font-bold text-green-900 text-right tabular-nums">
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
