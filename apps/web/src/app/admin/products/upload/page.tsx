import { ProductUploadWizard } from "@/components/admin/product-upload-wizard";

export const metadata = { title: "Upload Products | THREAD Admin" };

export default function UploadProductsPage() {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <ProductUploadWizard />
    </div>
  );
}
