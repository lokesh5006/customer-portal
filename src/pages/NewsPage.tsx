import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Calendar } from 'lucide-react';
import { ListingPageHeader } from '@/components/listing';

const newsItems = [
  {
    id: '1',
    title: 'NumberCruncher v4.2 Released',
    date: '2026-04-10',
    summary: 'New performance improvements, bug fixes, and enhanced reporting features in the latest desktop release.',
    category: 'Product Update',
  },
  {
    id: '2',
    title: 'Spring 2026 Rate Updates',
    date: '2026-03-15',
    summary: 'Updated tax rate tables are now available for Q2 2026. Make sure to update your Rate Module.',
    category: 'Industry',
  },
  {
    id: '3',
    title: 'DataNet Platform Enhancements',
    date: '2026-03-01',
    summary: 'New data filtering options, enhanced export formats, and improved alert customization now available.',
    category: 'Product Update',
  },
  {
    id: '4',
    title: 'Upcoming Webinar: Best Practices for Year-End',
    date: '2026-02-15',
    summary: 'Join our expert panel on April 20 for a walkthrough of year-end preparation using NumberCruncher.',
    category: 'Event',
  },
  {
    id: '5',
    title: 'Customer Spotlight: ABC Accounting',
    date: '2026-01-20',
    summary: 'Learn how ABC Accounting streamlined their workflow with NumberCruncher and QuickView.',
    category: 'Community',
  },
];

export const NewsPage = () => {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? newsItems : newsItems.filter(n => n.category === filter);
  const categories = [...new Set(newsItems.map(n => n.category))];

  return (
    <MainLayout>
      <div className="space-y-6">
        <ListingPageHeader
          title="News"
          description="Stay up to date with the latest updates and announcements"
          showCompanyContext={false}
        />

        <div className="flex gap-2">
          <Badge
            variant={filter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            All News
          </Badge>
          {categories.map(cat => (
            <Badge
              key={cat}
              variant={filter === cat ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setFilter(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>

        {/* Recent News */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Recent News</h2>
          <div className="space-y-3">
            {filtered.slice(0, 2).map(item => (
              <Card key={item.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* All News */}
        {filtered.length > 2 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">All News</h2>
            <div className="space-y-3">
              {filtered.slice(2).map(item => (
                <Card key={item.id} className="cursor-pointer hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Newspaper className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <h3 className="font-medium text-sm">{item.title}</h3>
                          <p className="text-xs text-muted-foreground">{item.summary}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
