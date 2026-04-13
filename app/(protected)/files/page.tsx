import { readdir } from "fs/promises";
import { join } from "path";
import Link from "next/link";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";

const EXTERNAL_RESOURCES = [
  {
    name: "選民服務知識庫",
    url: "https://officeingaytali.gitbook.io/service/",
  },
];

async function getPdfFiles(): Promise<string[]> {
  const dir = join(process.cwd(), "public", "files");
  try {
    const entries = await readdir(dir);
    return entries
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export default async function FilesPage() {
  const pdfs = await getPdfFiles();

  return (
    <PageContainer>
      <PageHeader title="文件" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* PDF files */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">參考文件</h2>
          <div className="rounded-lg border bg-card">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    檔案名稱
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pdfs.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-muted-foreground">尚無文件</td>
                  </tr>
                ) : (
                  pdfs.map((file) => (
                    <tr key={file}>
                      <td className="px-6 py-3">
                        <Link
                          href={`/files/${file}`}
                          target="_blank"
                          className="text-primary hover:underline"
                        >
                          {file.replace(/\.pdf$/i, "")}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* External resources */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">其它資源</h2>
          <div className="rounded-lg border bg-card">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">
                    資源名稱
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {EXTERNAL_RESOURCES.map((resource) => (
                  <tr key={resource.name}>
                    <td className="px-6 py-3">
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {resource.name}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
