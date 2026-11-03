"use client";

import { useActionState } from "react";
import {
  updateProfile,
  type ProfileState,
} from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UserProfile = {
  heightCm: number | null;
  weightKg: number | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
};

const initialState: ProfileState = {};

export function ProfileForm({ user }: { user: UserProfile }) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="heightCm" className="text-xs">
            身高（cm）
          </Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={130}
            max={210}
            defaultValue={user.heightCm ?? ""}
            placeholder="选填"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weightKg" className="text-xs">
            体重（kg）
          </Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            inputMode="numeric"
            min={30}
            max={200}
            defaultValue={user.weightKg ?? ""}
            placeholder="选填"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bustCm" className="text-xs">
            胸围（cm）
          </Label>
          <Input
            id="bustCm"
            name="bustCm"
            type="number"
            inputMode="numeric"
            min={60}
            max={160}
            defaultValue={user.bustCm ?? ""}
            placeholder="选填"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="waistCm" className="text-xs">
            腰围（cm）
          </Label>
          <Input
            id="waistCm"
            name="waistCm"
            type="number"
            inputMode="numeric"
            min={40}
            max={140}
            defaultValue={user.waistCm ?? ""}
            placeholder="选填"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hipCm" className="text-xs">
            臀围（cm）
          </Label>
          <Input
            id="hipCm"
            name="hipCm"
            type="number"
            inputMode="numeric"
            min={60}
            max={160}
            defaultValue={user.hipCm ?? ""}
            placeholder="选填"
            className="h-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "保存中…" : "保存身材信息"}
        </Button>
        {state.error ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-xs text-emerald-600">
            已保存
          </p>
        ) : null}
      </div>
    </form>
  );
}
