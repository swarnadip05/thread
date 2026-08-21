"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Checkbox,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  FieldLabel,
  IconButton,
  Input,
  Pagination,
  Price,
  RadioGroup,
  RadioGroupItem,
  SearchInput,
  Select,
  Sheet,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from "@thread/ui";
import { Heart } from "lucide-react";
import { useState } from "react";

const options = [
  { label: "Newest", value: "newest" },
  { label: "Price: low to high", value: "price-low" },
] as const;

export function DesignSystemShowcase() {
  const [page, setPage] = useState(2);
  const { toast } = useToast();
  return (
    <div className="shell-container py-12">
      <div className="max-w-3xl">
        <Badge variant="gold">Development only</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          THREAD design system
        </h1>
        <p className="mt-4 text-muted">
          Accessible primitives and restrained foundations for the storefront.
        </p>
      </div>
      <Showcase title="Actions and status">
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="gold">Signature</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <IconButton aria-label="Add to wishlist">
            <Heart aria-hidden="true" className="size-5" />
          </IconButton>
          <Badge variant="success">In stock</Badge>
          <Badge variant="error">Unavailable</Badge>
        </div>
      </Showcase>
      <Showcase title="Inputs">
        <div className="grid max-w-xl gap-5">
          <div className="grid gap-2">
            <FieldLabel htmlFor="demo-email">Email</FieldLabel>
            <Input id="demo-email" placeholder="you@example.com" />
          </div>
          <SearchInput aria-label="Demo search" placeholder="Search products" />
          <div className="flex items-center gap-2">
            <Checkbox id="demo-check" />
            <FieldLabel htmlFor="demo-check">Notify me about new releases</FieldLabel>
          </div>
          <RadioGroup aria-label="Fit" defaultValue="regular">
            <label className="flex items-center gap-2">
              <RadioGroupItem value="regular" />
              Regular fit
            </label>
            <label className="flex items-center gap-2">
              <RadioGroupItem value="oversized" />
              Oversized fit
            </label>
          </RadioGroup>
          <Select ariaLabel="Sort products" defaultValue="newest" options={options} />
        </div>
      </Showcase>
      <Showcase title="Commerce display">
        <div className="flex items-center gap-6">
          <Price amount={129900} />
          <Price amount={79900} className="text-success" />
          <Skeleton className="h-8 w-36" />
        </div>
      </Showcase>
      <Showcase title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Dialog
            title="Size guide"
            description="Choose the best fit."
            trigger={<Button variant="outline">Open dialog</Button>}
          >
            <p className="text-sm text-muted">
              Dialog content stays focused and keyboard accessible.
            </p>
          </Dialog>
          <Drawer
            title="Filters"
            description="Refine the catalogue."
            trigger={<Button variant="outline">Open drawer</Button>}
          >
            <p className="text-sm text-muted">Bottom drawer content.</p>
          </Drawer>
          <Sheet
            title="Categories"
            description="Browse departments."
            trigger={<Button variant="outline">Open sheet</Button>}
          >
            <p className="text-sm text-muted">Side sheet content.</p>
          </Sheet>
          <Button
            onClick={() =>
              toast({
                title: "Saved",
                description: "Your preference was updated.",
                variant: "success",
              })
            }
          >
            Show toast
          </Button>
        </div>
      </Showcase>
      <Showcase title="Disclosure">
        <div className="grid gap-8">
          <Accordion collapsible type="single">
            <AccordionItem value="shipping">
              <AccordionTrigger>Shipping information</AccordionTrigger>
              <AccordionContent>
                Domestic delivery normally takes 3–7 business days.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="returns">
              <AccordionTrigger>Returns</AccordionTrigger>
              <AccordionContent>
                Eligible unworn and unwashed items may be returned within seven days of delivery.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="care">Care</TabsTrigger>
            </TabsList>
            <TabsContent value="details">Product detail panel.</TabsContent>
            <TabsContent value="care">Wash inside out in cold water.</TabsContent>
          </Tabs>
        </div>
      </Showcase>
      <Showcase title="States">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            title="Nothing here yet"
            description="Items will appear here when available."
          />
          <ErrorState title="Something went wrong" description="Please try again in a moment." />
        </div>
      </Showcase>
      <Showcase title="Pagination">
        <Pagination currentPage={page} onPageChange={setPage} totalPages={5} />
      </Showcase>
    </div>
  );
}

function Showcase({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mt-12 border-t border-ink/10 pt-8">
      <h2 className="mb-6 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
