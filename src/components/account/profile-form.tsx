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
  name: string | null;
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
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">昵称</Label>
        <Input
          id="name"
          name="name"
          maxLength={30}
          defaultValue={user.name ?? ""}
          placeholder="怎么称呼你"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heightCm">身高（cm）</Label>
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={130}
            max={210}
            defaultValue={user.heightCm ?? ""}
            placeholder="选填"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightKg">体重（kg）</Label>
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            inputMode="numeric"
            min={30}
            max={200}
            defaultValue={user.weightKg ?? ""}
            placeholder="选填"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bustCm">胸围（cm）</Label>
          <Input
            id="bustCm"
            name="bustCm"
            type="number"
            inputMode="numeric"
            min={60}
            max={160}
            defaultValue={user.bustCm ?? ""}
            placeholder="选填"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="waistCm">腰围（cm）</Label>
          <Input
            id="waistCm"
            name="waistCm"
            type="number"
            inputMode="numeric"
            min={40}
            max={140}
            defaultValue={user.waistCm ?? ""}
            placeholder="选填"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hipCm">臀围（cm）</Label>
          <Input
            id="hipCm"
            name="hipCm"
            type="number"
            inputMode="numeric"
            min={60}
            max={160}
            defaultValue={user.hipCm ?? ""}
            placeholder="选填"
          />
        </div>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        身材数据全部选填，仅用于合身判断，只有你本人能看到；可随时清空。
      </p>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="text-sm text-emerald-600">
          已保存
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "保存中…" : "保存资料"}
      </Button>
    </form>
  );
}
