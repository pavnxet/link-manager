export interface Link {
  id: string;
  title: string;
  page_title: string | null;
  url: string;
  category: string | null;
  created_at: string;
}

export interface CreateLinkInput {
  title: string;
  page_title?: string;
  url: string;
  category?: string;
}

export interface UpdateLinkInput {
  title?: string;
  page_title?: string;
  url?: string;
  category?: string;
}

export interface DatabaseAdapter {
  getLinks(query?: string): Promise<Link[]>;
  createLink(input: CreateLinkInput): Promise<Link>;
  updateLink(id: string, input: UpdateLinkInput): Promise<void>;
  deleteLink(id: string): Promise<void>;
  getNextId(): Promise<number>;
  exportLinks(): Promise<Link[]>;
  importLinks(links: Partial<Link>[]): Promise<{ success: boolean; count: number }>;
}
