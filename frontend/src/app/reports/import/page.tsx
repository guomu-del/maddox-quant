import { ImportReportForm } from "@/components/reports/ImportReportForm";

export default function ImportReportPage() {
  return (
    <div className="px-4 py-8">
      <div className="mx-auto mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold">导入研报</h1>
        <p className="mt-1 text-sm text-zinc-600">上传 PDF 并填写元数据，系统将自动解析全文。</p>
      </div>
      <ImportReportForm />
    </div>
  );
}
