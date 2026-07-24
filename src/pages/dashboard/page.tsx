import { useIntl } from "react-intl";
import { Toolbar, ToolbarActions, ToolbarDescription, ToolbarHeading, ToolbarPageTitle, ToolbarSidebarToggle } from "@/components/layouts/dashboard/components/toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardPage() {
  const intl = useIntl();
  return (
    <div className="container-fluid"> 
      <Toolbar>
        <div className="flex items-center gap-3">
          <ToolbarSidebarToggle />
          <ToolbarHeading>
            <ToolbarPageTitle>{intl.formatMessage({ id: 'Team Settings' })}</ToolbarPageTitle>
            <ToolbarDescription>{intl.formatMessage({ id: 'Some info tells the story' })}</ToolbarDescription>
          </ToolbarHeading>
        </div>
        <ToolbarActions>
          <Button variant="outline">{intl.formatMessage({ id: 'View Profile' })}</Button>
        </ToolbarActions>
      </Toolbar>
      <Skeleton className="rounded-lg grow h-screen"></Skeleton>
    </div>
  );
}
