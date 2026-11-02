import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AddressDefaults = {
  recipient?: string | null;
  phone?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detail?: string | null;
  isDefault?: boolean;
};

export function AddressFields({
  idPrefix,
  defaults = {},
}: {
  idPrefix: string;
  defaults?: AddressDefaults;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-recipient`}>收件人</Label>
        <Input
          id={`${idPrefix}-recipient`}
          name="recipient"
          required
          maxLength={30}
          defaultValue={defaults.recipient ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>手机号</Label>
        <Input
          id={`${idPrefix}-phone`}
          name="phone"
          required
          inputMode="numeric"
          maxLength={11}
          defaultValue={defaults.phone ?? ""}
          placeholder="11 位手机号"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-province`}>省份</Label>
        <Input
          id={`${idPrefix}-province`}
          name="province"
          required
          maxLength={30}
          defaultValue={defaults.province ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-city`}>城市</Label>
        <Input
          id={`${idPrefix}-city`}
          name="city"
          required
          maxLength={30}
          defaultValue={defaults.city ?? ""}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-district`}>区 / 县</Label>
        <Input
          id={`${idPrefix}-district`}
          name="district"
          required
          maxLength={30}
          defaultValue={defaults.district ?? ""}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-detail`}>详细地址</Label>
        <textarea
          id={`${idPrefix}-detail`}
          name="detail"
          required
          maxLength={120}
          rows={2}
          defaultValue={defaults.detail ?? ""}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={defaults.isDefault}
          className="size-4 rounded border-input accent-primary"
        />
        设为默认地址
      </label>
    </div>
  );
}
