import { jsPDF } from 'jspdf'

export async function generateInvoicePDF({ invoice, client, profile }) {
  const doc = new jsPDF()
  const blue = [0, 66, 170]    // #0042AA
  const dark = [10, 22, 40]    // #0A1628
  const gray = [107, 114, 128]

  // Header bar
  doc.setFillColor(...blue)
  doc.rect(0, 0, 210, 32, 'F')

  // Company name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(profile?.business_name || 'ConsultPro', 14, 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const profileLines = [
    profile?.title,
    profile?.address_line1,
    [profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', '),
    profile?.phone,
    profile?.email,
  ].filter(Boolean)
  doc.text(profileLines.join('  |  '), 14, 24)

  // INVOICE label
  doc.setTextColor(...dark)
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', 196, 20, { align: 'right' })

  // Invoice meta box
  const metaY = 40
  doc.setFillColor(240, 244, 248) // #F0F4F8
  doc.roundedRect(120, metaY, 76, 42, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...gray)
  doc.text('INVOICE #', 124, metaY + 8)
  doc.text('DATE', 124, metaY + 18)
  doc.text('DUE DATE', 124, metaY + 28)
  doc.text('STATUS', 124, metaY + 38)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...dark)
  doc.text(invoice.invoice_number || '—', 196, metaY + 8, { align: 'right' })
  doc.text(invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : '—', 196, metaY + 18, { align: 'right' })
  doc.text(invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—', 196, metaY + 28, { align: 'right' })
  doc.text((invoice.status || 'draft').toUpperCase(), 196, metaY + 38, { align: 'right' })

  // Bill To
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...blue)
  doc.text('BILL TO', 14, metaY + 8)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...dark)
  doc.setFontSize(11)
  doc.text(client?.name || 'Client', 14, metaY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...gray)
  const clientLines = [
    client?.contact_name,
    client?.email,
    client?.phone,
    client?.address,
  ].filter(Boolean)
  clientLines.forEach((line, i) => {
    doc.text(line, 14, metaY + 26 + i * 7)
  })

  // Divider
  const tableY = 96
  doc.setDrawColor(...blue)
  doc.setLineWidth(0.5)
  doc.line(14, tableY, 196, tableY)

  // Table header
  doc.setFillColor(...blue)
  doc.rect(14, tableY, 182, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIPTION', 18, tableY + 6)
  doc.text('TYPE', 110, tableY + 6)
  doc.text('AMOUNT', 192, tableY + 6, { align: 'right' })

  // Row
  const rowY = tableY + 9
  doc.setFillColor(248, 250, 252)
  doc.rect(14, rowY, 182, 10, 'F')
  doc.setTextColor(...dark)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(invoice.notes || 'Consulting services', 18, rowY + 7)
  doc.text(invoice.billing_type || 'hourly', 110, rowY + 7)
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, 192, rowY + 7, { align: 'right' })

  // Totals
  const totY = rowY + 20
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...gray)
  doc.setFontSize(9)
  doc.text('Subtotal', 150, totY)
  doc.setTextColor(...dark)
  doc.text(`$${Number(invoice.amount).toFixed(2)}`, 192, totY, { align: 'right' })

  if (invoice.tax_rate > 0) {
    doc.setTextColor(...gray)
    doc.text(`Tax (${invoice.tax_rate}%)`, 150, totY + 8)
    doc.setTextColor(...dark)
    const tax = Number(invoice.amount) * Number(invoice.tax_rate) / 100
    doc.text(`$${tax.toFixed(2)}`, 192, totY + 8, { align: 'right' })
  }

  // Total box
  doc.setFillColor(...blue)
  doc.roundedRect(130, totY + 14, 66, 12, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  const totalAmount = Number(invoice.amount) * (1 + (Number(invoice.tax_rate) || 0) / 100)
  doc.text('TOTAL', 136, totY + 22)
  doc.text(`$${totalAmount.toFixed(2)}`, 192, totY + 22, { align: 'right' })

  // Footer
  doc.setTextColor(...gray)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Thank you for your business.', 105, 270, { align: 'center' })
  if (profile?.website) doc.text(profile.website, 105, 276, { align: 'center' })
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.line(14, 265, 196, 265)

  return doc
}
