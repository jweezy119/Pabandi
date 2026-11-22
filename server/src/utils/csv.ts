/**
 * Minimal RFC 4180 CSV parser.
 *
 * WHY THIS EXISTS
 * The CRM importers did `line.split(',')`. That silently mangles three things a
 * real spreadsheet exports all the time:
 *
 *   - a quoted field containing a comma   `"Quoted job, with comma"` -> two fields
 *   - a quoted field containing a newline  -> the row splits in half
 *   - a doubled quote                     `"He said ""hi"""`      -> `He said "hi`
 *
 * The first two are worse than a parse failure: they import a row with shifted
 * columns, so `value` lands in `stage` and the pipeline forecast is quietly wrong
 * for a file the user was told imported successfully.
 *
 * Unbalanced quotes THROW rather than being tolerated, because a mangled row that
 * imports is the failure mode this file is meant to remove.
 */

export class CsvParseError extends Error {}

/** One row of fields. Quotes are stripped and `""` collapses to `"`. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldOpenedWithQuote = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
    fieldOpenedWithQuote = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote is an escaped quote; anything else closes the field.
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    // A quote only opens a quoted field at the START of a field. Mid-field it is
    // literal, which is what Excel does with a stray quote in an unquoted cell.
    if (ch === '"' && field === '' && !fieldOpenedWithQuote) {
      inQuotes = true;
      fieldOpenedWithQuote = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      endField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (inQuotes) {
    throw new CsvParseError('unbalanced quote: a quoted field is never closed');
  }

  // Push the final row only if it has content. A trailing newline already ended
  // the last row above, and synthesising another would create a phantom empty row.
  if (field !== '' || row.length > 0 || fieldOpenedWithQuote) {
    endRow();
  }

  return rows;
}

export function csvCell(row: string[], header: string[], name: string): string {
  const i = header.indexOf(name);
  return i === -1 ? '' : (row[i] ?? '').trim();
}
