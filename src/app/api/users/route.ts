import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Contact from "@/models/Contact";
import User from "@/models/User";

type PlainContactUser = {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  status?: string;
  isOnline?: boolean;
  lastSeen?: string | Date;
};

function toPlainContactUser(value: unknown): PlainContactUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("toObject" in value && typeof value.toObject === "function") {
    return value.toObject() as PlainContactUser;
  }

  if ("_id" in value || "name" in value || "email" in value) {
    return value as PlainContactUser;
  }

  return null;
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectDB();

    const contacts = await Contact.find({
      owner: session.user.id,
    })
      .populate(
        "contactUser",
        "name email phone avatar bio status isOnline lastSeen",
      )
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      users: contacts
        .map((contact) => {
          const contactUser = toPlainContactUser(contact.contactUser);

          if (!contactUser) {
            return null;
          }

          const accountName = contactUser.name;
          const savedName = contact.savedName?.trim() || accountName;

          return {
            ...contactUser,
            name: savedName,
            savedName,
            accountName,
          };
        })
        .filter(Boolean),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch contacts",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

const addContactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().min(8).max(20),
});

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = addContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Valid phone number is required" },
        { status: 400 },
      );
    }

    await connectDB();

    const phone = parsed.data.phone.trim();
    const savedName = parsed.data.name.trim();
    const contactUser = await User.findOne({ phone }).select(
      "name email phone avatar bio status isOnline lastSeen",
    );

    if (!contactUser) {
      return NextResponse.json(
        { success: false, message: "No registered user found with that phone number" },
        { status: 404 },
      );
    }

    if (contactUser._id.toString() === session.user.id) {
      return NextResponse.json(
        { success: false, message: "You cannot add yourself as a contact" },
        { status: 400 },
      );
    }

    const existingContact = await Contact.findOne({
      owner: session.user.id,
      contactUser: contactUser._id,
    });

    if (existingContact) {
      existingContact.savedName = savedName;
      await existingContact.save();

      return NextResponse.json({
        success: true,
        message: "Contact updated",
        user: {
          ...(contactUser.toObject?.() ?? contactUser),
          name: savedName,
          savedName,
          accountName: contactUser.name,
        },
      });
    }

    await Contact.create({
      owner: session.user.id,
      contactUser: contactUser._id,
      savedName,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Contact added",
        user: {
          ...(contactUser.toObject?.() ?? contactUser),
          name: savedName,
          savedName,
          accountName: contactUser.name,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to add contact",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

const updateContactSchema = z.object({
  contactUserId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
});

export async function PATCH(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = updateContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Valid contact and saved name are required" },
        { status: 400 },
      );
    }

    await connectDB();

    let contact = await Contact.findOne({
      owner: session.user.id,
      contactUser: parsed.data.contactUserId,
    });

    if (!contact) {
      const contactUser = await User.findById(parsed.data.contactUserId).select(
        "name email phone avatar bio status isOnline lastSeen",
      );

      if (!contactUser) {
        return NextResponse.json(
          { success: false, message: "Contact not found" },
          { status: 404 },
        );
      }

      if (contactUser._id.toString() === session.user.id) {
        return NextResponse.json(
          { success: false, message: "You cannot save yourself as a contact" },
          { status: 400 },
        );
      }

      contact = await Contact.create({
        owner: session.user.id,
        contactUser: contactUser._id,
        savedName: parsed.data.name.trim(),
      });
    }

    contact = await contact.populate(
      "contactUser",
      "name email phone avatar bio status isOnline lastSeen",
    );

    if (!contact) {
      return NextResponse.json(
        { success: false, message: "Contact not found" },
        { status: 404 },
      );
    }

    contact.savedName = parsed.data.name.trim();
    await contact.save();

    const contactUser = toPlainContactUser(contact.contactUser);

    if (!contactUser) {
      return NextResponse.json(
        { success: false, message: "Contact user not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact name updated",
      user: {
        ...contactUser,
        name: contact.savedName,
        savedName: contact.savedName,
        accountName: contactUser.name,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update contact",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const contactUserId = searchParams.get("contactUserId");

    if (!contactUserId) {
      return NextResponse.json(
        { success: false, message: "contactUserId is required" },
        { status: 400 },
      );
    }

    await connectDB();

    const deletedContact = await Contact.findOneAndDelete({
      owner: session.user.id,
      contactUser: contactUserId,
    });

    if (!deletedContact) {
      return NextResponse.json(
        { success: false, message: "Saved contact not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Contact removed",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete contact",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
