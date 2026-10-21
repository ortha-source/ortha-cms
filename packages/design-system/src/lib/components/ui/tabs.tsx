'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '../../utils';
import {
    mergeRefs,
    useActiveIndicator
} from '../../hooks/use-active-indicator';
import { TabIndicator } from './tab-nav';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => {
    // One underline that slides between tabs — see `TabIndicator`.
    const indicator = useActiveIndicator<HTMLDivElement>(
        '[role=tab][data-state=active]'
    );
    const listRef = React.useMemo(
        () => mergeRefs(ref, indicator.ref),
        [ref, indicator.ref]
    );
    return (
        <TabsPrimitive.List
            ref={listRef}
            data-indicator={indicator.rect ? 'live' : undefined}
            className={cn(
                'group/tabs relative flex w-full items-center justify-start gap-5 border-b border-border text-muted-foreground',
                className
            )}
            {...props}
        >
            {children}
            <TabIndicator rect={indicator.rect} settled={indicator.settled} />
        </TabsPrimitive.List>
    );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
            // Underlined (incident.io-style) tabs: a transparent bottom border
            // that fills in on the active tab, overlapping the list's border.
            'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-1 pb-2 pt-1 text-sm font-medium transition-colors',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
            '-mb-px data-[state=active]:border-foreground data-[state=active]:text-foreground',
            // While the list's sliding underline is live it draws the active
            // border; the trigger's own stays as the no-JS / first-frame one.
            'group-data-[indicator=live]/tabs:data-[state=active]:border-transparent',
            className
        )}
        {...props}
    />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
        )}
        {...props}
    />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
