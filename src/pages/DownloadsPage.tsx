import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Book, Newspaper, FileSpreadsheet, Bell } from 'lucide-react';

const downloads = {
  installers: [
    { name: 'NumberCruncher Desktop v5.2', size: '245 MB', product: 'Desktop' },
    { name: 'NumberCruncher Desktop v5.1', size: '240 MB', product: 'Desktop' },
  ],
  docs: [
    { name: 'User Guide 2024', size: '12 MB', product: 'All' },
    { name: 'Quick Start Guide', size: '2 MB', product: 'All' },
  ],
  newsletters: [
    { name: 'January 2024 Newsletter', size: '1 MB', date: '2024-01-15' },
    { name: 'December 2023 Newsletter', size: '1 MB', date: '2023-12-15' },
  ],
  rateSheets: [
    { name: '2024 Rate Sheet', size: '500 KB', year: '2024' },
  ],
  releaseNotes: [
    { name: 'v5.2 Release Notes', size: '200 KB', version: '5.2' },
    { name: 'v5.1 Release Notes', size: '180 KB', version: '5.1' },
  ],
};

export const DownloadsPage = () => {
  const { toast } = useToast();

  const handleDownload = (name: string) => {
    toast({ title: 'Download started', description: `Downloading ${name}...` });
  };

  const DownloadItem = ({ name, size, extra }: { name: string; size: string; extra?: string }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{size}{extra && ` • ${extra}`}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => handleDownload(name)}>
        <Download className="h-4 w-4 mr-1" /> Download
      </Button>
    </div>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Downloads</h1>
          <p className="text-muted-foreground">Software, documentation, and resources</p>
        </div>

        <Tabs defaultValue="installers">
          <TabsList>
            <TabsTrigger value="installers">Installers</TabsTrigger>
            <TabsTrigger value="docs">Documentation</TabsTrigger>
            <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
            <TabsTrigger value="rateSheets">Rate Sheets</TabsTrigger>
            <TabsTrigger value="releaseNotes">Release Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="installers" className="space-y-3 mt-4">
            {downloads.installers.map((d, i) => <DownloadItem key={i} name={d.name} size={d.size} extra={d.product} />)}
          </TabsContent>
          <TabsContent value="docs" className="space-y-3 mt-4">
            {downloads.docs.map((d, i) => <DownloadItem key={i} name={d.name} size={d.size} />)}
          </TabsContent>
          <TabsContent value="newsletters" className="space-y-3 mt-4">
            {downloads.newsletters.map((d, i) => <DownloadItem key={i} name={d.name} size={d.size} extra={d.date} />)}
          </TabsContent>
          <TabsContent value="rateSheets" className="space-y-3 mt-4">
            {downloads.rateSheets.map((d, i) => <DownloadItem key={i} name={d.name} size={d.size} extra={d.year} />)}
          </TabsContent>
          <TabsContent value="releaseNotes" className="space-y-3 mt-4">
            {downloads.releaseNotes.map((d, i) => <DownloadItem key={i} name={d.name} size={d.size} extra={d.version} />)}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};
