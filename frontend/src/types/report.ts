export interface Report {
  id: number;
  title: string;
  source?: string | null;
  author?: string | null;
  publish_date?: string | null;
  industries?: string[] | null;
  sectors?: string[] | null;
  stocks?: string[] | null;
  summary?: string | null;
  full_text?: string | null;
  file_path?: string | null;
  file_hash?: string | null;
  tags?: string[] | null;
  status: "pending" | "parsed" | "failed";
  created_at?: string | null;
}

export interface ReportListResponse {
  items: Report[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReportImportForm {
  title: string;
  source?: string;
  author?: string;
  publish_date?: string;
  industries?: string;
  sectors?: string;
  stocks?: string;
  tags?: string;
  summary?: string;
  file: File;
}

export interface DuplicateReportError {
  detail: {
    detail: string;
    existing_report_id: number;
  };
}
