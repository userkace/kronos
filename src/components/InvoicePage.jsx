import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Calendar, DollarSign, User, MapPin, Globe } from 'lucide-react';
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

// Register fonts
Font.register({
  family: 'Helvetica',
  src: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
});

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
    width: '30%',
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
          <Text style={styles.businessAddress}>{settings.userAddress || '123 Business Street'}</Text>
          <Text style={styles.businessAddress}>{settings.userAddress ? '' : 'City, State 12345'}</Text>
          <Text style={styles.businessAddress}>{settings.userEmail || 'contact@yourbusiness.com'}</Text>
        </View>

        <View style={styles.clientInfo}>
          <Text style={styles.sectionTitle}>BILL TO:</Text>
          <Text style={styles.businessName}>{settings.clientName}</Text>
          <Text style={styles.businessAddress}>{settings.clientAddress}</Text>
        </View>

        <View style={styles.invoiceDetails}>
          <View>
            <Text style={styles.invoiceNumber}>INVOICE #{settings.invoiceNumber}</Text>
            <Text style={styles.invoiceDate}>Date: {format(new Date(), 'MMM dd, yyyy')}</Text>
          </View>
          <View>
            <Text style={styles.invoiceDate}>Period: {settings.startDate} - {settings.endDate}</Text>
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
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{invoiceData.subtotal}</Text>
          </View>
          <View style={styles.grandTotal}>
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL:</Text>
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
      invoiceNumber: savedSettings.invoiceNumber || `INV-${format(weekEnd, 'yyyy-MM-dd')}`
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

  const formatCurrency = (amount) => {
    const symbols = {
      USD: '$',
      EUR: '€',
      GBP: '£'
    };
    return `${symbols[settings.currency]}${amount.toFixed(2)}`;
  };

  const calculateDuration = (dayData) => {
    if (!dayData.timeIn || !dayData.timeOut) return 0;

    try {
      // Parse time strings (HH:MM format)
      const [inHours, inMinutes] = dayData.timeIn.split(':').map(Number);
      const [outHours, outMinutes] = dayData.timeOut.split(':').map(Number);

      // Convert to total seconds
      const inTotalSeconds = (inHours * 3600) + (inMinutes * 60);
      const outTotalSeconds = (outHours * 3600) + (outMinutes * 60);

      // Calculate difference
      let durationSeconds = outTotalSeconds - inTotalSeconds;

      // Handle overnight shifts
      if (durationSeconds < 0) {
        durationSeconds = durationSeconds + (24 * 3600);
      }

      // Subtract break hours (convert to seconds)
      const breakSeconds = (parseFloat(dayData.breakHours || '0') || 0) * 3600;
      durationSeconds = durationSeconds - breakSeconds;

      // Don't allow negative duration
      return Math.max(0, durationSeconds);
    } catch (error) {
      console.error('Error calculating duration:', error);
      return 0;
    }
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
          // Calculate duration from timeIn, timeOut, and breakHours
          const duration = calculateDuration(dayData);
          if (duration > 0) {
            entries.push({
              date: format(entryDate, 'MMM dd, yyyy'),
              description: dayData.workDetails || dayData.tasks || 'Time Entry',
              amount: formatCurrency((duration / 3600) * settings.hourlyRate),
              hours: (duration / 3600).toFixed(2),
              duration: duration
            });
          }
        }
      } catch (error) {
        console.error('Error processing date:', dateKey, error);
      }
    });

    return entries;
  }, [timesheetData, settings.startDate, settings.endDate, settings.hourlyRate]);

  const filteredEntries = filterEntries;

  const calculateTotals = () => {
    const totalHours = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.hours), 0);
    const subtotal = totalHours * settings.hourlyRate;
    return {
      totalHours: totalHours.toFixed(2),
      subtotal: formatCurrency(subtotal),
      total: formatCurrency(subtotal)
    };
  };

  const generateFileName = () => {
    const businessName = settings.userName || 'Business';
    // Clean the business name for filename (remove special characters, replace spaces with underscores)
    const cleanBusinessName = businessName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    return `${cleanBusinessName}-${settings.invoiceNumber}.pdf`;
  };

  const totals = useMemo(() => calculateTotals(), [filteredEntries, settings.hourlyRate]);

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="INV-001"
                  />
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
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

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-900">Total Amount</span>
                  <span className="text-lg font-bold text-green-900">{totals.total}</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Based on {settings.currency} {settings.hourlyRate}/hour
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

              {filteredEntries.length > 0 && settings.clientName && (
                <PDFDownloadLink
                  document={
                    <InvoicePDF
                      invoiceData={totals}
                      settings={settings}
                      entries={filteredEntries}
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
            </div>

            {filteredEntries.length === 0 ? (
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
                    {filteredEntries.map((entry, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{entry.date}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{entry.description}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">{entry.hours}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right">
                          {formatCurrency(parseFloat(entry.hours) * settings.hourlyRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={2} className="py-3 px-4 text-sm font-medium text-gray-700">
                        Total ({totals.totalHours} hours)
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-sm font-bold text-gray-900 text-right">
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
