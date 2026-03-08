export type TypeDefinations = {


        //VAS
            serviceCategoryId: {
                _id: string,
                name: string,
                identifier: string,
                service: string,
                vendor: string,
                isFixedAmount: string,
                description: string,
                logoUrl: string,
                createdAt: string,
                updatedAt: string,
                __v: string,
            },
            serviceId: {
                _id: string,
                name: string,
                identifier: string,
                description: string,
                createdAt: string,
                updatedAt: string,
                __v: string,
            },
            productName: string,
            reference: string,
            internalReference: string,
            debitPaymentReference: string,
            reversalPaymentReference: string,
            transactionId: string,
            transactionStatus: string,
            receiverNumber: string,
            vasType: string,
            channel: string,
            paymentStatus: string,
            vendor: string,
            transactionFee: string,
            debitedAmount: string,
            transactionAmount: string,
            createdAt: string,
            updatedAt: string,
            __v: string,

        //Statement
    
        _id: string,
        cbaTransactionId: string,
        client: string,
        account: {
            canDebit: string,
            canCredit: string,
            _id: string,
            client: string,
            accountProduct: string,
            accountNumber: string,
            accountName: string,
            accountType: string,
            currencyCode: string,
            bvn: string,
            accountBalance: string,
            bookBalance: string,
            interestBalance: string,
            withHoldingTaxBalance: string,
            status: string,
            isDefault: string,
            nominalAnnualInterestRate: string,
            interestCompoundingPeriod: string,
            interestPostingPeriod: string,
            interestCalculationType: string,
            interestCalculationDaysInYearType: string,
            minRequiredOpeningBalance: string,
            lockinPeriodFrequency: string,
            lockinPeriodFrequencyType: string,
            allowOverdraft: string,
            overdraftLimit: string,
            chargeWithHoldingTax: string,
            chargeValueAddedTax: string,
            chargeStampDuty: string,
            notificationSettings: {
                _id: string,
                smsNotification: string,
                smsMonthlyStatement: string,
                emailNotification: string,
                emailMonthlyStatement: string,
            },
            isSubAccount: string,
            isDeleted: string,
            createdAt: string,
            updatedAt: string,
            __v: string,
            cbaAccountId: string,
            documents: {
                _id: string,
                smsDeactivationUrl: string,
            }
        },
        paymentReference: string,
        type: string,
        provider: string,
        providerChannel: string,
        narration: string,
        amount: string,
        runningBalance: string,
        transactionDate: string,
        valueDate: string,
        __v: string,
    

    //dataPlans
    id: string,
    uid: string,
    type: string,
    validity: string,
    network: string,
    adexGAmount: string,
    adexSAmount: string,
    adexCode: string,
    msorgGAmount: string,
    isHot: internal,

    n3tDataCode: string,
    n3tDataGAmount: string,

    bilalsadaCode: string,
    bilalsadaGAmount: string,
    bilalsadaSAmount: string,

    maskawaCode: string,
    maskawaGAmount: string,

    msorgSAmount: string,
    msorgCode: string,
    GB: string,
    MB: number,

    //PalmpayAccountStatement
    orderNo: string;
    orderStatus: string;
    createdTime: string;
    updateTime: string;
    currency: string;
    orderAmount: string;
    reference: string;
    payerAccountNo: string;
    payerAccountName: string;
    payerBankName: string;
    virtualAccountNo: string;
    virtualAccountName: string;
    accountReference: string;
    appId: string;

    //bankList
    bankName: string,
    status: string,
    code: string,

    //users
    email: string,
    phoneNumber: string,
    displayName: string,
    otherNames: string,
    password: string,
    referral: string,
    referralStatus: string,
    notificationToken: string,
    profile: string,
    lat: string,
    lng: string,

    user: {
        email: string,
        phoneNumber: string,
        displayName: string,
        otherNames: string,
        password: string,
        referral: string,
        referralStatus: string,
        notificationToken: string,
        profile: string,
        status: string,
    }

    //users account
    type: string,
    account_balance: string,
    account_name: string,
    account_number: string,
    bank_name: string,
    created_at: string,
    identityNumber: string,
    pin: string,
    expiryDate: string,


    palmPay: {
        uid: string;
        identityType: string;
        licenseNumber: string;
        virtualAccountName: string;
        virtualAccountNo: string;
        bankName: string;
        email: string;
        customerName: string;
        status: string;
        accountReference: string;
        created_at: string;
      }

      safeHaven: {
        uid: string;
        type: string;
        identityType: string;
        licenseNumber: string;
        virtualAccountName: string;
        virtualAccountNo: string;
        bankName: string;
        status: string;
        created_at: string;
        expiryDate: string;
      }

    //admin
    role: number,
    username: string,
    pin: string,
    phone: string,
    lastLogin: string,
    reg_date: string,
    
    //verification
    name: string,
    icone: string,

    //transactions
    device: string,
    sid: string,
    rid: string,
    transctionTo: string,
    category: string,
    balance_before: string,
    balance_after: string,
    profit: string,
    GB_amount: string,
    beneficiaryBankCode: string,
    nameEnquiryReference: string,
    reference: string,
    description: string,
    datetime: string,
    date: string,
    icon: string,
    amount: string,
    revoked: string,
    token: string,

    transaction:{
        //transactions
        id: string,
        device: string,
        uid: string,
        sid: string,
        rid: string,
        type: string,
        phoneNumber: string,
        transctionTo: string,
        category: string,
        balance_before: string,
        balance_after: string,
        profit: string,
        GB_amount: string,
        beneficiaryBankCode: string,
        nameEnquiryReference: string,
        reference: string,
        description: string,
        datetime: string,
        date: string,
        icon: string,
        amount: string,
        revoked: string,
        status: string,
    }


    api_response: string,
    ident: string,
    balance_before: string,
    balance_after: string,
    mobile_number: string,
    Status: string,
    plan_network: string,
    plan_name: string,
    plan_amount: string,
    create_date: string,
    Ported_number: boolean,
    payment_medium: string

    accountBalance: int,
    accountNumber: string,
    accountName: string,

    serviceName: string,
    serviceIcon: string,
    state: int,

    users_account: {
        account_balance: string,
        status: string
    }

    serviceProvider: {
        id: number,
        uid: string,
        email: string,
        phone_number: string,
        business_name: string,
        business_description: string,
        rating: number,
        completed_orders: string,
        logo: string,
        lat: string,
        lng: string,
        address: string,
        id_card: string,
        verification_status: string,
        created_at: string,
        updated_at: string,
    }

    userProfile: {
        id: number,
        uid: string,
        email: string,
        phoneNumber: string,
        displayName: string,
        otherNames: string,
        password: string,
        address: string,
        referral: string,
        referralStatus: string,
        notificationToken: string,
        profile: string,
    }

    skills:{
        category: string,
        service: string,
        subService: string
    }[]

    recentWork:{
        id: number,
        uid: string,
        title: string,
        description: string,
        media_url: string,
        created_at: string,
    }[]

    pricing:{
        id: number,
        uid: string,
        service_name: string,
        price: string,
        description: string
    }[]

    identityType: string;
    licenseNumber: string;
    virtualAccountName: string;
    virtualAccountNo: string;
    bankName: string;
    staffStatus: number;
    created_at: string;
    expiryDate: string;

    customerName: string;
    accountReference: string;

    business_name: string;
    business_description: string;
    phone_number : string;
    lat: string;
    lng: string;
    verification_status: string;
    address: string;
    title: string,
    message: string,
}


