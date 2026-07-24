import { Toolbar, ToolbarActions, ToolbarDescription, ToolbarHeading, ToolbarPageTitle, ToolbarSidebarToggle } from "@/components/layouts/dashboard/components/toolbar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardPage() {
  return (
    <div className="container-fluid"> 
      <Toolbar>
        <div className="flex items-center gap-3">
          <ToolbarSidebarToggle />
          <ToolbarHeading>
            <ToolbarPageTitle>Team Settings</ToolbarPageTitle>
            <ToolbarDescription>Some info tells the story</ToolbarDescription>
          </ToolbarHeading>
        </div>
        <ToolbarActions>
          <Button variant="outline">View Profile</Button>
        </ToolbarActions>
      </Toolbar>
      <Skeleton className="rounded-lg grow h-screen"></Skeleton>
    </div>
  );
}
