import { Link } from "react-router";
import { useLocation } from "react-router-dom";
import { useMenu } from "@/hooks/use-menu";
import { useIntl } from "react-intl";
import { cn } from "@/lib/utils";
import { MENU_HEADER } from "@/config/dashboard.config";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

export function HeaderMenu() {
  const { pathname } = useLocation();
  const { isActive } = useMenu(pathname);
  const intl = useIntl();

  return (
    <div className="flex items-stretch">
      <Separator orientation="vertical" className="hidden lg:block h-7 mx-5 my-auto bg-white/15"/>
      <div className="grid">
        <nav className="list-none flex items-center gap-2.5">
          {MENU_HEADER.map((item, index) => {
            const active = isActive(item.path);
            return (
              <Button 
                key={index}
                variant="ghost"
                className={cn(
                  "inline-flex items-center text-sm font-medium",
                  active
                    ? "bg-white/15 text-white hover:text-white border font-normal border-white/20 hover:bg-white/15"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
                asChild
              >
                <Link to={item.path || '#'}>
                  {item.icon && <item.icon className="size-4"/>}
                  {intl.formatMessage({ id: item.title })}
                </Link>
              </Button>
            )
          })}
        </nav>
      </div>
    </div>
  );
}
