import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import type { 
  ExportOptions, 
  ExportableStudentStats, 
  ExportField,
  AppData,
} from '@/types';
import { encrypt } from './encryption';

const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  { key: 'lastName', label: 'Nachname', enabled: true },
  { key: 'firstName', label: 'Vorname', enabled: true },
  { key: 'className', label: 'Klasse', enabled: true },
  { key: 'subject', label: 'Fach', enabled: true },
  { key: 'positive', label: 'Positiv (+)', enabled: true },
  { key: 'neutral', label: 'Neutral (o)', enabled: true },
  { key: 'negative', label: 'Negativ (-)', enabled: true },
  { key: 'total', label: 'Gesamt', enabled: true },
  { key: 'trend', label: 'Trend', enabled: true },
];

export function getDefaultExportFields(): ExportField[] {
  return DEFAULT_EXPORT_FIELDS.map(f => ({ ...f }));
}

export function formatDateLocale(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatNumberLocale(num: number): string {
  return num.toLocaleString('de-DE');
}

export function generateStatisticsData(
  data: AppData,
  options: ExportOptions
): ExportableStudentStats[] {
  const result: ExportableStudentStats[] = [];
  const { dateRange, subjectFilter, classFilter } = options;

  for (const cls of data.classes) {
    if (classFilter && cls.id !== classFilter) continue;

    for (const student of cls.students) {
      let participations = data.participations.filter(
        (p) => p.studentId === student.id
      );

      if (subjectFilter) {
        participations = participations.filter((p) => p.subject === subjectFilter);
      }

      if (dateRange.startDate) {
        participations = participations.filter(
          (p) => new Date(p.date) >= new Date(dateRange.startDate!)
        );
      }
      if (dateRange.endDate) {
        participations = participations.filter(
          (p) => new Date(p.date) <= new Date(dateRange.endDate!)
        );
      }

      const subjects = subjectFilter 
        ? [subjectFilter] 
        : [...new Set(participations.map(p => p.subject))];

      for (const subject of subjects) {
        const subjectParticipations = participations.filter(p => p.subject === subject);
        
        if (subjectParticipations.length === 0) continue;

        const positive = subjectParticipations.filter((e) => e.rating === '+').length;
        const neutral = subjectParticipations.filter((e) => e.rating === 'o').length;
        const negative = subjectParticipations.filter((e) => e.rating === '-').length;
        const total = subjectParticipations.length;
        const trend = positive - negative;

        const latestDate = subjectParticipations.reduce((latest, p) => {
          return new Date(p.date) > new Date(latest) ? p.date : latest;
        }, subjectParticipations[0].date);

        result.push({
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          className: cls.name,
          subject,
          positive,
          neutral,
          negative,
          total,
          trend,
          date: latestDate,
        });
      }
    }
  }

  return result.sort((a, b) => a.lastName.localeCompare(b.lastName));
}



export function generateCSV(
  statsData: ExportableStudentStats[],
  fields: ExportField[]
): string {
  const enabledFields = fields.filter((f) => f.enabled);
  const headers = enabledFields.map((f) => f.label);
  
  const rows = statsData.map((stats) => {
    return enabledFields.map((field) => {
      const value = stats[field.key as keyof ExportableStudentStats];
      if (field.key === 'trend') {
        const numVal = Number(value);
        return numVal > 0 ? `+${numVal}` : String(numVal);
      }
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return String(value);
    });
  });

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  return csvContent;
}

export function generateExcelWorkbook(
  statsData: ExportableStudentStats[],
  fields: ExportField[]
): XLSX.WorkBook {
  const enabledFields = fields.filter((f) => f.enabled);
  
  const worksheetData = statsData.map((stats) => {
    const row: Record<string, string | number> = {};
    for (const field of enabledFields) {
      const value = stats[field.key as keyof ExportableStudentStats];
      if (field.key === 'trend') {
        const numVal = Number(value);
        row[field.label] = numVal > 0 ? `+${numVal}` : String(numVal);
      } else {
        row[field.label] = value;
      }
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  
  const colWidths = enabledFields.map((f) => ({ wch: Math.max(f.label.length, 12) }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistik');

  return workbook;
}

export function generatePDFHTML(
  statsData: ExportableStudentStats[],
  fields: ExportField[],
  title: string = 'Statistik Export'
): string {
  const enabledFields = fields.filter((f) => f.enabled);
  const now = new Date();
  const dateStr = formatDateLocale(now.toISOString());
  const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const headerCells = enabledFields
    .map((f) => `<th style="padding: 10px 8px; text-align: left; border-bottom: 2px solid #16171A; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${f.label}</th>`)
    .join('');

  const bodyRows = statsData
    .map((stats, index) => {
      const bgColor = index % 2 === 0 ? '#FFFFFF' : '#F8F9FA';
      const cells = enabledFields
        .map((field) => {
          const value = stats[field.key as keyof ExportableStudentStats];
          let displayValue: string;
          let cellStyle = '';
          
          if (field.key === 'trend') {
            const numVal = Number(value);
            displayValue = numVal > 0 ? `+${numVal}` : String(numVal);
            if (numVal > 0) cellStyle = 'color: #16171A; font-weight: 600;';
            else if (numVal < 0) cellStyle = 'color: #CC3B2A; font-weight: 600;';
            else cellStyle = 'color: #94979E;';
          } else if (field.key === 'positive') {
            displayValue = String(value);
            cellStyle = 'color: #16171A;';
          } else if (field.key === 'negative') {
            displayValue = String(value);
            cellStyle = 'color: #CC3B2A;';
          } else {
            displayValue = String(value);
          }
          
          return `<td style="padding: 10px 8px; border-bottom: 1px solid #E5E5E5; font-size: 12px; ${cellStyle}">${displayValue}</td>`;
        })
        .join('');
      return `<tr style="background-color: ${bgColor};">${cells}</tr>`;
    })
    .join('');

  const totalPositive = statsData.reduce((sum, s) => sum + s.positive, 0);
  const totalNeutral = statsData.reduce((sum, s) => sum + s.neutral, 0);
  const totalNegative = statsData.reduce((sum, s) => sum + s.negative, 0);
  const totalEntries = statsData.reduce((sum, s) => sum + s.total, 0);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page { margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #16171A;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #16171A;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 22px;
      font-weight: 700;
      color: #16171A;
    }
    .header .meta {
      font-size: 12px;
      color: #6E7078;
    }
    .summary {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .summary-item {
      background: #F4F4F6;
      padding: 12px 16px;
      border-radius: 8px;
      min-width: 100px;
    }
    .summary-item .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6E7078;
      margin-bottom: 4px;
    }
    .summary-item .value {
      font-size: 18px;
      font-weight: 600;
      color: #16171A;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #E5E5E5;
      font-size: 10px;
      color: #A9ABB3;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="meta">Erstellt am ${dateStr} um ${timeStr} Uhr | ${statsData.length} Einträge</div>
  </div>
  
  <div class="summary">
    <div class="summary-item">
      <div class="label">Positiv</div>
      <div class="value">${formatNumberLocale(totalPositive)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Neutral</div>
      <div class="value">${formatNumberLocale(totalNeutral)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Negativ</div>
      <div class="value" style="color: #CC3B2A;">${formatNumberLocale(totalNegative)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Gesamt</div>
      <div class="value">${formatNumberLocale(totalEntries)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>

  <div class="footer">
    Dieser Export wurde automatisch generiert. Alle Daten sind vertraulich.
  </div>
</body>
</html>
`;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export async function exportToFile(
  statsData: ExportableStudentStats[],
  options: ExportOptions
): Promise<ExportResult> {
  try {
    console.log('[Export] Starting export with format:', options.format);
    console.log('[Export] Data count:', statsData.length);

    if (statsData.length === 0) {
      return { success: false, error: 'Keine Daten zum Exportieren vorhanden.' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let fileUri = '';
    let mimeType = '';
    let fileName = '';

    if (options.format === 'csv') {
      const csvContent = generateCSV(statsData, options.fields);
      let finalContent = csvContent;
      
      if (options.encrypted && options.password) {
        finalContent = encrypt(csvContent, options.password);
        fileName = `statistik_${timestamp}.csv.enc`;
      } else {
        fileName = `statistik_${timestamp}.csv`;
      }
      
      if (Platform.OS === 'web') {
        downloadOnWeb(finalContent, fileName, 'text/csv');
        return { success: true, filePath: fileName };
      }

      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.cache, fileName);
      file.write(finalContent);
      fileUri = file.uri;
      mimeType = 'text/csv';

    } else if (options.format === 'xlsx') {
      const workbook = generateExcelWorkbook(statsData, options.fields);
      const xlsxData = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      
      fileName = `statistik_${timestamp}.xlsx`;
      
      if (Platform.OS === 'web') {
        const binaryString = atob(xlsxData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true, filePath: fileName };
      }

      const { File, Paths } = await import('expo-file-system');
      const binaryString = atob(xlsxData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const file = new File(Paths.cache, fileName);
      file.write(bytes);
      fileUri = file.uri;
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    } else if (options.format === 'pdf') {
      const html = generatePDFHTML(statsData, options.fields);
      
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return { success: true, filePath: 'print-dialog' };
      }

      const { uri } = await Print.printToFileAsync({ html });
      
      fileName = `statistik_${timestamp}.pdf`;
      
      const { File } = await import('expo-file-system');
      const tempFile = new File(uri);
      const newFile = new File(uri.replace(/[^/]+$/, fileName));
      tempFile.move(newFile);
      
      fileUri = newFile.uri;
      mimeType = 'application/pdf';
    }

    if (Platform.OS !== 'web' && fileUri) {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType,
          dialogTitle: 'Statistik exportieren',
          UTI: options.format === 'pdf' ? 'com.adobe.pdf' : undefined,
        });
      }
    }

    console.log('[Export] Export successful:', fileUri || fileName);
    return { success: true, filePath: fileUri || fileName };

  } catch (error) {
    console.error('[Export] Export error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Export fehlgeschlagen' 
    };
  }
}

function downloadOnWeb(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generatePreviewHTML(
  statsData: ExportableStudentStats[],
  fields: ExportField[]
): string {
  return generatePDFHTML(statsData.slice(0, 10), fields, 'Vorschau (erste 10 Einträge)');
}
