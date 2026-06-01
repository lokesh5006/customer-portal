import { useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { useApp, ROLE_LABELS } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import {
  parseImportData, buildTemplateBlob, triggerDownload, ParseResult, MAX_PREVIEW_ROWS,
  ExistingDirectory,
} from '@/lib/bulkImportValidation';
import { Upload, FileSpreadsheet, Check, X, AlertCircle, Download, CheckCircle2, Loader2 } from 'lucide-react';

type Step = 'upload' | 'preview' | 'result';

export const BulkImportDialog = ({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) => {
  const { getCompanyUsers, currentCompany, addUser } = useApp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [resultError, setResultError] = useState('');

  const reset = () => {
    setStep('upload');
    setFileName('');
    setResult(null);
    setDragOver(false);
    setImporting(false);
    setImportedCount(0);
    setResultError('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const existingDirectory = (): ExistingDirectory => {
    const users = getCompanyUsers();
    return {
      emails: new Set(users.map(u => u.email.toLowerCase())),
      usernames: new Set(users.map(u => (u.username || '').toLowerCase())),
    };
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv')) {
      toast({ title: 'Unsupported file', description: 'Please upload a .xlsx or .csv file.', variant: 'destructive' });
      return;
    }
    const buffer = await file.arrayBuffer();
    const parsed = parseImportData(buffer, existingDirectory());
    setFileName(file.name);
    setResult(parsed);
    if (parsed.fileError) {
      // Stay on upload step and surface the file-level error inline.
      setStep('upload');
    } else {
      setStep('preview');
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    triggerDownload(buildTemplateBlob(format), `bulk-import-template.${format}`);
  };

  const confirmImport = () => {
    if (!result || result.invalidCount > 0) return;
    setImporting(true);
    setResultError('');
    try {
      // All-or-nothing: validation already guarantees every row is importable.
      result.rows.forEach(r => {
        addUser({
          firstName: r.parsed.firstName,
          lastName: r.parsed.lastName,
          email: r.parsed.email,
          username: r.parsed.username,
          phone: r.parsed.phone,
          roles: r.parsed.roles,
          dataNetEmailOptIn: r.parsed.dataNetEmailOptIn,
          status: 'invited',
          lastLogin: null,
        });
      });
      setImportedCount(result.rows.length);
      setStep('result');
    } catch (err) {
      setResultError(err instanceof Error ? err.message : 'Import failed. No users were added.');
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = result?.rows.slice(0, MAX_PREVIEW_ROWS) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Users</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a .xlsx or .csv file of users to invite.'}
            {step === 'preview' && `Reviewing ${fileName}`}
            {step === 'result' && 'Import complete'}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1 — Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-10 cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:bg-muted/30'}`}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drag &amp; drop your file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">Accepts .xlsx and .csv (max 500 rows)</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onPickFile} />
            </div>

            {result?.fileError && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{result.fileError}</span>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Need a template?</span>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate('xlsx')}>
                <Download className="h-3.5 w-3.5 mr-1" />.xlsx template
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadTemplate('csv')}>
                <Download className="h-3.5 w-3.5 mr-1" />.csv template
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Preview */}
        {step === 'preview' && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{result.totalRows} total rows</span>
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">{result.validCount} valid</Badge>
              {result.invalidCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">{result.invalidCount} invalid</Badge>
              )}
            </div>

            {result.invalidCount > 0 && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Cannot import. Fix the invalid rows in your file and re-upload.</span>
              </div>
            )}

            <div className="border rounded-md max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>First</TableHead>
                    <TableHead>Last</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role(s)</TableHead>
                    <TableHead>DataNet</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map(r => (
                    <TableRow key={r.rowNumber} className={r.valid ? '' : 'bg-destructive/5'}>
                      <TableCell>
                        {r.valid ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span><X className="h-4 w-4 text-destructive" /></span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <ul className="list-disc pl-4 text-xs">
                                {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.parsed.firstName || '—'}</TableCell>
                      <TableCell className="text-sm">{r.parsed.lastName || '—'}</TableCell>
                      <TableCell className="text-sm">{r.parsed.email || '—'}</TableCell>
                      <TableCell className="text-sm">{r.parsed.username || '—'}</TableCell>
                      <TableCell className="text-sm">{r.parsed.phone || '—'}</TableCell>
                      <TableCell className="text-sm">
                        {r.parsed.roles.length > 0 ? r.parsed.roles.map(role => ROLE_LABELS[role]).join(', ') : (r.parsed.rolesRaw || '—')}
                      </TableCell>
                      <TableCell className="text-sm">{r.parsed.dataNetEmailOptIn ? 'Yes' : 'No'}</TableCell>
                      <TableCell className="text-sm capitalize">{r.parsed.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {result.totalRows > MAX_PREVIEW_ROWS && (
              <p className="text-xs text-muted-foreground">Showing first {MAX_PREVIEW_ROWS} of {result.totalRows} rows.</p>
            )}
          </div>
        )}

        {/* STEP 3 — Result */}
        {step === 'result' && (
          <div className="py-6 flex flex-col items-center text-center gap-3">
            {resultError ? (
              <>
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <p className="font-medium">Import failed</p>
                <p className="text-sm text-muted-foreground">{resultError}</p>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-success" />
                </div>
                <p className="font-medium">{importedCount} user{importedCount > 1 ? 's' : ''} imported successfully</p>
                <p className="text-sm text-muted-foreground">
                  They've been added to {currentCompany?.name} with status “Invited.”
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { reset(); }}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Choose another file
              </Button>
              <Button onClick={confirmImport} disabled={result?.invalidCount !== 0 || importing}>
                {importing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Import {result?.validCount} user{(result?.validCount ?? 0) > 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
