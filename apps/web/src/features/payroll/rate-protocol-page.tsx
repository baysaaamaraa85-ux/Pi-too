import { Link } from "react-router";
import { PageHeader } from "@/app/app-shell";
import { RateProtocolPanel } from "./rates-ui";

// D-67: захирлын цалингийн протокол. Хөтөлбөр бүрийн жишиг цагийн үнэлгээ ба багшийн оруулсан үнэлгээний тулгалт.
export function AdminRateProtocolPage() {
  return (
    <>
      <PageHeader
        title="Цалингийн протокол"
        subtitle="Хөтөлбөрийн жишиг цагийн үнэлгээ, багшийн оруулсан үнэлгээтэй тулгах"
        action={
          <Link to="/admin/payroll" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
            Цалин руу буцах
          </Link>
        }
      />
      <RateProtocolPanel />
    </>
  );
}
