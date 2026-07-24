import { Settings, User, LogOut, Sun, Moon, Globe, ChevronDown, Users } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useI18n } from '@/i18n/i18n-context';
import { useAuth } from '@/features/auth/auth-context';
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '@/i18n/config';
import type { Locale } from '@/i18n/config';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarIndicator,
  AvatarStatus,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NotificationsBell } from '@/features/notifications/notifications-bell';

const LANGUAGES = LOCALES.map((code) => ({
  code,
  label: LOCALE_LABELS[code],
  flag: toAbsoluteUrl(LOCALE_FLAGS[code]),
}));

// Panel flotante que se sobrepone hacia abajo (submenu de idioma en pantallas pequenas).
const FLOATING_PANEL =
  'absolute start-0 top-full z-50 mt-1 min-w-full max-w-[calc(100vw-1rem)] space-y-0.5 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md shadow-black/5';

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';
}

export function HeaderToolbar() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useI18n();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [langOpen, setLangOpen] = useState(false);

  const currentLanguage = LANGUAGES.find((item) => item.code === locale) ?? LANGUAGES[0];
  const name = user?.name ?? '';
  const email = user?.email ?? '';

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const languageItems = (
    <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
      {LANGUAGES.map((item) => (
        <DropdownMenuRadioItem key={item.code} value={item.code} className="flex items-center gap-2">
          <img src={item.flag} className="w-4 h-4 rounded-full" alt={item.label} />
          <span>{item.label}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  const languageTrigger = (
    <>
      <Globe />
      <span className="flex items-center justify-between gap-2 grow relative">
        {t('profile.language')}
        <Badge variant="outline" className="absolute end-0 top-1/2 -translate-y-1/2">
          {currentLanguage.label}
          <img
            src={currentLanguage.flag}
            className="w-3.5 h-3.5 rounded-full"
            alt={currentLanguage.label}
          />
        </Badge>
      </span>
    </>
  );

  return (
    <nav className="flex items-center gap-2.5">
      {/* Accion rapida (placeholder para uso futuro) */}
      <Button
        variant="outline"
        className="border border-white/20 bg-white/15 text-white hover:bg-white/25 hover:text-white"
      >
        <Users className="size-4 text-white" />
        <span>{t('header.addTeammate')}</span>
      </Button>

      {/* Notificaciones (tiempo real) + ajustes */}
      <div className="flex items-center gap-1">
        <NotificationsBell />
        <Button
          variant="ghost"
          size="icon"
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <Settings className="opacity-100" />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="cursor-pointer">
          <Avatar className="size-8">
            <AvatarImage src={toAbsoluteUrl('/media/avatars/300-2.png')} alt={name} />
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
            <AvatarIndicator className="-end-2 -top-2">
              <AvatarStatus variant="online" className="size-2.5" />
            </AvatarIndicator>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64 max-lg:overflow-visible" side="bottom" align="end" sideOffset={11}>
          {/* Usuario actual */}
          <div className="flex items-center gap-3 p-3">
            <Avatar>
              <AvatarImage src={toAbsoluteUrl('/media/avatars/300-2.png')} alt={name} />
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate text-sm font-semibold text-foreground">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem>
            <User />
            <span>{t('profile.profile')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem>
            <Settings />
            <span>{t('profile.settings')}</span>
          </DropdownMenuItem>

          {/* Idioma: flyout lateral en desktop, panel hacia abajo en pantallas pequenas */}
          {isMobile ? (
            <div
              className="relative"
              onPointerEnter={(event) => { if (event.pointerType === 'mouse') setLangOpen(true); }}
              onPointerLeave={(event) => { if (event.pointerType === 'mouse') setLangOpen(false); }}
            >
              <DropdownMenuItem
                data-state={langOpen ? 'open' : 'closed'}
                className="hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input"
                onSelect={(event) => {
                  event.preventDefault();
                  setLangOpen((value) => !value);
                }}
              >
                {languageTrigger}
                <ChevronDown
                  className={cn('ms-auto size-3.5 shrink-0 opacity-60 transition-transform', langOpen && 'rotate-180')}
                />
              </DropdownMenuItem>
              {langOpen && <div className={FLOATING_PANEL}>{languageItems}</div>}
            </div>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="flex items-center gap-2 [&_[data-slot=dropdown-menu-sub-trigger-indicator]]:hidden hover:[&_[data-slot=badge]]:border-input data-[state=open]:[&_[data-slot=badge]]:border-input">
                {languageTrigger}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">{languageItems}</DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Tema */}
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="size-4" /> : <Sun className="size-4" />}
            <span>{theme === 'light' ? t('profile.darkMode') : t('profile.lightMode')}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={handleLogout}>
            <LogOut />
            <span>{t('profile.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
