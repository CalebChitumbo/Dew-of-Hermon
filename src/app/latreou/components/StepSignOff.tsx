"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { LatreouCycle } from "../lib/types";
import { buildLatreouPdf } from "../lib/pdf";
import { PreviewDocument } from "./PreviewDocument";

interface StepSignOffProps {
  cycle: LatreouCycle;
}

export function StepSignOff({ cycle }: StepSignOffProps) {
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = () => {
    try {
      buildLatreouPdf(cycle);
      toast({
        title: "PDF generated",
        description: "Your worship cycle document is downloading.",
      });
    } catch (err) {
      console.error("Failed to build Latreou PDF", err);
      toast({
        title: "PDF generation failed",
        description: "Something went wrong building the document.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preview & download</CardTitle>
          <p className="text-sm text-clay-500">
            Review the finished document before sharing it with the team.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="mr-1 h-4 w-4" />
              Preview document
            </Button>
            <Button type="button" variant="gold" onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document preview</DialogTitle>
          </DialogHeader>
          <PreviewDocument cycle={cycle} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button variant="gold" onClick={handleDownload}>
              <Download className="mr-1 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
