import { getAllDocs, getCategories } from "@/lib/docs";
import DocUploader from "@/components/admin/DocUploader";
import DocTable from "@/components/admin/DocTable";

export default async function AdminContentPage() {
  const [docs, categories] = await Promise.all([getAllDocs(), getCategories()]);

  return (
    <div>
      <DocUploader categories={categories} />
      <DocTable docs={docs} categories={categories} />
    </div>
  );
}
