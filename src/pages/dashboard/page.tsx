import { useIntl } from "react-intl";
import {
  Toolbar,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarSidebarToggle,
} from "@/components/layouts/dashboard/components/toolbar";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  return (
    <div className="container-fluid">
      <Toolbar>
        <div className="flex items-center gap-3">
          <ToolbarSidebarToggle />
          <ToolbarHeading>
            <ToolbarPageTitle>{t('dashboard.home')}</ToolbarPageTitle>
            <ToolbarDescription>{t('dashboard.welcome')}</ToolbarDescription>
          </ToolbarHeading>
        </div>
      </Toolbar>
      <Skeleton className="rounded-lg grow h-screen"></Skeleton>
    </div>
  );
}
